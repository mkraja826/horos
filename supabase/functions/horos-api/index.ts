import {
  AstroProviderError,
  calculatePanchang,
  calculatePrediction,
  isAstroProviderConfigured,
} from "./astro.ts";
import { refreshSession, requestOtp, verifyOtp } from "./auth.ts";
import { corsHeaders } from "./cors.ts";
import {
  adminClient,
  cacheExpiry,
  getProfileRows,
  getSubscription,
  localDateInTimezone,
  periodKey,
  requireUser,
  ResponseError,
} from "./db.ts";
import { createProfile, deleteAccount, readProfile, updateProfile } from "./profiles.ts";
import {
  processRevenueCatWebhook,
  verifyRevenueCat,
  verifyWebhookAuthorization,
} from "./subscriptions.ts";
import type { Period } from "./types.ts";

const FUNCTION_NAME = "horos-api";

function requestPath(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const marker = `/${FUNCTION_NAME}`;
  const index = pathname.indexOf(marker);
  if (index >= 0) return pathname.slice(index + marker.length) || "/";
  return pathname || "/";
}

function json(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ResponseError("A valid JSON request body is required.", 400, "INVALID_JSON");
  }
  return body as Record<string, unknown>;
}

function validatePeriod(value: string): Period {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  throw new ResponseError("That horoscope period is not supported.", 404, "INVALID_PERIOD");
}

async function horoscope(userId: string, period: Period) {
  const [rows, subscription] = await Promise.all([
    getProfileRows(userId),
    getSubscription(userId),
  ]);
  if (!rows) throw new ResponseError("Complete your birth profile first.", 404, "PROFILE_NOT_FOUND");
  if (period !== "daily" && !subscription.isPremium) {
    throw new ResponseError(
      "This reading is available with complete access.",
      402,
      "PREMIUM_REQUIRED",
    );
  }

  const key = periodKey(period, rows.birth.timezone);
  const cached = await adminClient
    .from("horoscope_cache")
    .select("content_json")
    .eq("user_id", userId)
    .eq("period", period)
    .eq("period_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached.error) throw cached.error;

  const reading = cached.data?.content_json ?? await calculatePrediction(rows.birth, period, userId);
  if (!cached.data) {
    const save = await adminClient.from("horoscope_cache").upsert(
      {
        user_id: userId,
        period,
        period_key: key,
        content_json: reading,
        calculation_mode: "provider",
        expires_at: cacheExpiry(period, rows.birth.timezone),
      },
      { onConflict: "user_id,period,period_key" },
    );
    if (save.error) throw save.error;
  }
  return reading;
}

async function registerNotification(userId: string, body: Record<string, unknown>) {
  const pushToken = typeof body.pushToken === "string" ? body.pushToken.trim() : "";
  const notificationTime = typeof body.notificationTime === "string"
    ? body.notificationTime.trim()
    : "";
  if (pushToken.length < 10 || pushToken.length > 300) {
    throw new ResponseError("Notification details are invalid.", 400, "INVALID_NOTIFICATION");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(notificationTime)) {
    throw new ResponseError("Notification details are invalid.", 400, "INVALID_NOTIFICATION");
  }
  const rows = await getProfileRows(userId);
  if (!rows) throw new ResponseError("Complete your birth profile first.", 404, "PROFILE_NOT_FOUND");

  const notification = await adminClient.from("notifications").upsert(
    {
      user_id: userId,
      expo_push_token: pushToken,
      notification_time: notificationTime,
      timezone: rows.birth.timezone,
      enabled: true,
    },
    { onConflict: "user_id,expo_push_token" },
  );
  if (notification.error) throw notification.error;
  const profile = await adminClient
    .from("profiles")
    .update({ notifications_enabled: true, notification_time: notificationTime })
    .eq("user_id", userId);
  if (profile.error) throw profile.error;
  return { registered: true as const };
}

async function route(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const path = requestPath(request);
  if (request.method === "GET" && (path === "/" || path === "/health")) {
    return json(request, {
      service: "Daily Vedic Astro API",
      status: "ok",
      backend: "supabase",
      astroProvider: "skyfield_jpl_de440s",
      astroProviderConfigured: isAstroProviderConfigured(),
      time: new Date().toISOString(),
    });
  }

  if (request.method === "POST" && path === "/auth/login") {
    const body = await bodyJson(request);
    const result = body.otp ? await verifyOtp(request, body) : await requestOtp(request, body);
    return json(request, result);
  }
  if (request.method === "POST" && path === "/auth/refresh") {
    return json(request, await refreshSession(await bodyJson(request)));
  }
  if (request.method === "POST" && path === "/subscription/webhook") {
    verifyWebhookAuthorization(request);
    await processRevenueCatWebhook(await bodyJson(request));
    return json(request, { received: true });
  }

  const user = await requireUser(request);

  if (request.method === "POST" && path === "/profile/create") {
    return json(request, await createProfile(user, await bodyJson(request)), 201);
  }
  if (request.method === "GET" && path === "/profile/me") {
    return json(request, await readProfile(user));
  }
  if (request.method === "PUT" && path === "/profile/update") {
    return json(request, await updateProfile(user, await bodyJson(request)));
  }
  if (request.method === "DELETE" && path === "/profile/me") {
    return json(request, await deleteAccount(user));
  }

  if (request.method === "GET" && path.startsWith("/horoscope/")) {
    return json(request, await horoscope(user.id, validatePeriod(path.split("/").pop() ?? "")));
  }

  if (request.method === "GET" && path === "/birth-chart") {
    const [rows, subscription] = await Promise.all([
      getProfileRows(user.id),
      getSubscription(user.id),
    ]);
    if (!subscription.isPremium) {
      throw new ResponseError(
        "Birth chart summary requires complete access.",
        402,
        "PREMIUM_REQUIRED",
      );
    }
    if (!rows?.birth.chart_json) {
      throw new ResponseError("Complete your birth profile first.", 404, "CHART_NOT_FOUND");
    }
    return json(request, rows.birth.chart_json);
  }

  if (request.method === "GET" && path === "/panchang/today") {
    const [rows, subscription] = await Promise.all([
      getProfileRows(user.id),
      getSubscription(user.id),
    ]);
    if (!subscription.isPremium) {
      throw new ResponseError("Panchang requires complete access.", 402, "PREMIUM_REQUIRED");
    }
    if (!rows) throw new ResponseError("Complete your birth profile first.", 404, "PROFILE_NOT_FOUND");
    const result = await calculatePanchang(
      {
        localDate: localDateInTimezone(rows.birth.timezone),
        timezone: rows.birth.timezone,
        latitude: rows.birth.latitude,
        longitude: rows.birth.longitude,
        altitudeMeters: rows.birth.altitude_meters,
        locationLabel: rows.birth.birth_place,
      },
      user.id,
    );
    return json(request, result);
  }

  if (request.method === "GET" && path === "/subscription/status") {
    return json(request, await getSubscription(user.id));
  }
  if (request.method === "POST" && path === "/subscription/verify") {
    const body = await bodyJson(request);
    const platform = body.platform;
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if ((platform !== "android" && platform !== "ios") || productId.length < 3) {
      throw new ResponseError("Purchase details are incomplete.", 400, "INVALID_PURCHASE");
    }
    return json(request, await verifyRevenueCat(user.id, platform, productId));
  }

  if (request.method === "POST" && path === "/notifications/register") {
    return json(request, await registerNotification(user.id, await bodyJson(request)));
  }

  throw new ResponseError("API route not found.", 404, "NOT_FOUND");
}

Deno.serve(async (request) => {
  try {
    return await route(request);
  } catch (error) {
    console.error(error);
    if (error instanceof ResponseError) {
      return json(
        request,
        { code: error.code, message: error.message, ...error.details },
        error.status,
        error.headers,
      );
    }
    if (error instanceof AstroProviderError) {
      return json(
        request,
        {
          code: "ASTROLOGY_PROVIDER_UNAVAILABLE",
          message: error.message,
          providerCode: error.providerCode,
          requestId: error.requestId,
        },
        error.status,
      );
    }
    const message = Deno.env.get("ENVIRONMENT") === "production"
      ? "Something went wrong. Please try again."
      : error instanceof Error
      ? error.message
      : "Unknown server error.";
    return json(request, { code: "INTERNAL_ERROR", message }, 500);
  }
});
