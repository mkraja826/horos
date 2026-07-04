import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { calculateChart, calculatePanchang, generateReading } from "./astrology";
import { createToken, hashOtp, normalizeIdentifier, requireAuth } from "./auth";
import { getSubscription, processRevenueCatWebhook, verifyRevenueCat } from "./subscriptions";
import type { Bindings, ChartResult, ProfileRow, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return "*";
      const allowed = (c.env.ALLOWED_ORIGINS || "").split(",").map((item: string) => item.trim());
      return allowed.includes(origin) || c.env.ENVIRONMENT !== "production" ? origin : "";
    },
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400
  })
);

app.get("/", (c) =>
  c.json({
    service: "Daily Vedic Astro API",
    status: "ok",
    environment: c.env.ENVIRONMENT,
    time: new Date().toISOString()
  })
);

const loginSchema = z.object({
  identifier: z.string().min(5).max(160),
  challengeId: z.string().uuid().optional(),
  otp: z.string().regex(/^\d{6}$/).optional()
});

app.post("/auth/login", async (c) => {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
    return c.json({ code: "SERVER_MISCONFIGURED", message: "Authentication is not configured." }, 503);
  }
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: "INVALID_LOGIN", message: "Enter a valid phone number or email address." }, 400);
  const identifier = normalizeIdentifier(parsed.data.identifier);

  if (!parsed.data.challengeId || !parsed.data.otp) {
    if (c.env.ENVIRONMENT === "production" && (!c.env.OTP_PROVIDER_URL || !c.env.OTP_PROVIDER_TOKEN)) {
      return c.json({ code: "OTP_NOT_CONFIGURED", message: "Sign-in delivery is temporarily unavailable." }, 503);
    }

    const challengeId = crypto.randomUUID();
    const otp = c.env.OTP_PROVIDER_URL ? String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0") : "123456";
    const codeHash = await hashOtp(challengeId, otp, c.env.JWT_SECRET);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM otp_challenges WHERE expires_at < ? OR identifier = ?").bind(new Date().toISOString(), identifier),
      c.env.DB.prepare("INSERT INTO otp_challenges (id, identifier, code_hash, expires_at) VALUES (?, ?, ?, ?)").bind(
        challengeId,
        identifier,
        codeHash,
        expiresAt
      )
    ]);

    if (c.env.OTP_PROVIDER_URL) {
      const delivery = await fetch(c.env.OTP_PROVIDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.env.OTP_PROVIDER_TOKEN || ""}` },
        body: JSON.stringify({ identifier, code: otp, purpose: "Daily Vedic Astro sign-in", expiresInMinutes: 10 })
      });
      if (!delivery.ok) {
        await c.env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?").bind(challengeId).run();
        return c.json({ code: "OTP_DELIVERY_FAILED", message: "The verification code could not be sent." }, 502);
      }
    }

    return c.json({
      requiresOtp: true,
      challengeId,
      ...(c.env.ENVIRONMENT !== "production" ? { devOtp: otp } : {})
    });
  }

  const challenge = await c.env.DB.prepare(
    "SELECT id, identifier, code_hash, attempts, expires_at FROM otp_challenges WHERE id = ?"
  )
    .bind(parsed.data.challengeId)
    .first<{ id: string; identifier: string; code_hash: string; attempts: number; expires_at: string }>();
  if (!challenge || challenge.identifier !== identifier || new Date(challenge.expires_at).getTime() <= Date.now()) {
    return c.json({ code: "OTP_EXPIRED", message: "That code has expired. Request a new one." }, 400);
  }
  const submittedHash = await hashOtp(challenge.id, parsed.data.otp, c.env.JWT_SECRET);
  if (submittedHash !== challenge.code_hash) {
    if (challenge.attempts >= 4) {
      await c.env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?").bind(challenge.id).run();
      return c.json({ code: "OTP_LOCKED", message: "Too many attempts. Request a new code." }, 429);
    }
    await c.env.DB.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challenge.id).run();
    return c.json({ code: "OTP_INCORRECT", message: "That code is not correct." }, 400);
  }

  await c.env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?").bind(challenge.id).run();
  let user = await c.env.DB.prepare("SELECT id FROM users WHERE identifier = ? AND status = 'active'").bind(identifier).first<{ id: string }>();
  if (!user) {
    const userId = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO users (id, identifier, auth_type) VALUES (?, ?, ?)")
      .bind(userId, identifier, identifier.includes("@") ? "email" : "phone")
      .run();
    user = { id: userId };
  }
  const token = await createToken(user.id, c.env.JWT_SECRET);
  const profileRow = await getProfileRow(c.env.DB, user.id);
  return c.json({ token, profile: profileRow ? profileJson(profileRow) : null });
});

app.use("/profile/*", requireAuth);
app.use("/horoscope/*", requireAuth);
app.use("/birth-chart", requireAuth);
app.use("/panchang/*", requireAuth);
app.use("/subscription/status", requireAuth);
app.use("/subscription/verify", requireAuth);
app.use("/notifications/*", requireAuth);

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  gender: z.string().max(30).optional(),
  language: z.enum(["English", "Hindi", "Telugu"]),
  notificationTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeOfBirth: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  birthPlace: z.string().trim().min(2).max(180),
  currentCity: z.string().trim().max(120).optional(),
  timezone: z.string().min(3).max(80),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

app.post("/profile/create", async (c) => {
  const userId = c.get("userId");
  const parsed = profileSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: "INVALID_PROFILE", message: "Please check the required birth details." }, 400);
  const input = parsed.data;
  if (new Date(`${input.dateOfBirth}T${input.timeOfBirth}:00`).getTime() > Date.now()) {
    return c.json({ code: "INVALID_BIRTH_DATE", message: "Birth date cannot be in the future." }, 400);
  }

  let chart: ChartResult;
  try {
    chart = await calculateChart(c.env, input);
  } catch (error) {
    return c.json({ code: "ASTROLOGY_PROVIDER_UNAVAILABLE", message: error instanceof Error ? error.message : "Chart calculation is unavailable." }, 502);
  }

  const user = await c.env.DB.prepare("SELECT identifier FROM users WHERE id = ?").bind(userId).first<{ identifier: string }>();
  if (!user) return c.json({ code: "USER_NOT_FOUND", message: "Please sign in again." }, 401);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profiles (user_id, full_name, gender, preferred_language, current_city, notification_time)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         full_name = excluded.full_name,
         gender = excluded.gender,
         preferred_language = excluded.preferred_language,
         current_city = excluded.current_city,
         notification_time = excluded.notification_time,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, input.fullName, input.gender ?? null, input.language, input.currentCity ?? null, input.notificationTime),
    c.env.DB.prepare(
      `INSERT INTO birth_details
        (user_id, date_of_birth, time_of_birth, birth_place, timezone, latitude, longitude, rashi, nakshatra, lagna, chart_json, calculation_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         date_of_birth = excluded.date_of_birth,
         time_of_birth = excluded.time_of_birth,
         birth_place = excluded.birth_place,
         timezone = excluded.timezone,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         rashi = excluded.rashi,
         nakshatra = excluded.nakshatra,
         lagna = excluded.lagna,
         chart_json = excluded.chart_json,
         calculation_mode = excluded.calculation_mode,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      userId,
      input.dateOfBirth,
      input.timeOfBirth,
      input.birthPlace,
      input.timezone,
      input.latitude ?? null,
      input.longitude ?? null,
      chart.rashi,
      chart.nakshatra,
      chart.lagna,
      JSON.stringify(chart),
      chart.calculationMode
    ),
    c.env.DB.prepare("DELETE FROM horoscope_cache WHERE user_id = ?").bind(userId)
  ]);

  const existingSubscription = await c.env.DB.prepare("SELECT user_id FROM subscriptions WHERE user_id = ?").bind(userId).first();
  if (!existingSubscription) {
    const identifierHash = await hashOtp("trial-ledger", user.identifier, c.env.JWT_SECRET);
    const priorTrial = await c.env.DB.prepare("SELECT identifier_hash FROM trial_ledger WHERE identifier_hash = ?").bind(identifierHash).first();
    if (priorTrial) {
      await c.env.DB.prepare("INSERT INTO subscriptions (user_id, status) VALUES (?, 'expired')").bind(userId).run();
    } else {
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 86_400_000);
      await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO trial_ledger (identifier_hash) VALUES (?)").bind(identifierHash),
        c.env.DB.prepare(
          "INSERT INTO subscriptions (user_id, status, trial_start_date, trial_end_date) VALUES (?, 'trial', ?, ?)"
        ).bind(userId, start.toISOString(), end.toISOString())
      ]);
    }
  }

  const [profileRow, subscription] = await Promise.all([getProfileRow(c.env.DB, userId), getSubscription(c.env.DB, userId)]);
  return c.json({ profile: profileJson(profileRow!), subscription }, 201);
});

app.get("/profile/me", async (c) => {
  const profile = await getProfileRow(c.env.DB, c.get("userId"));
  if (!profile) return c.json({ code: "PROFILE_NOT_FOUND", message: "Complete your birth profile first." }, 404);
  return c.json({ profile: profileJson(profile) });
});

const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  gender: z.string().max(30).optional(),
  language: z.enum(["English", "Hindi", "Telugu"]).optional(),
  notificationTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notificationsEnabled: z.boolean().optional(),
  currentCity: z.string().trim().max(120).optional()
});

app.put("/profile/update", async (c) => {
  const userId = c.get("userId");
  const parsed = profileUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: "INVALID_PROFILE_UPDATE", message: "That profile change is not valid." }, 400);
  const input = parsed.data;
  await c.env.DB.prepare(
    `UPDATE profiles SET
      full_name = COALESCE(?, full_name),
      gender = COALESCE(?, gender),
      preferred_language = COALESCE(?, preferred_language),
      notification_time = COALESCE(?, notification_time),
      notifications_enabled = COALESCE(?, notifications_enabled),
      current_city = COALESCE(?, current_city),
      updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  )
    .bind(
      input.fullName ?? null,
      input.gender ?? null,
      input.language ?? null,
      input.notificationTime ?? null,
      input.notificationsEnabled === undefined ? null : input.notificationsEnabled ? 1 : 0,
      input.currentCity ?? null,
      userId
    )
    .run();
  const profile = await getProfileRow(c.env.DB, userId);
  if (!profile) return c.json({ code: "PROFILE_NOT_FOUND", message: "Complete your birth profile first." }, 404);
  return c.json({ profile: profileJson(profile) });
});

app.delete("/profile/me", async (c) => {
  const userId = c.get("userId");
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  return c.json({ deleted: true });
});

app.get("/horoscope/:period", async (c) => {
  const period = c.req.param("period") as "daily" | "weekly" | "monthly";
  if (!(["daily", "weekly", "monthly"] as string[]).includes(period)) {
    return c.json({ code: "INVALID_PERIOD", message: "That horoscope period is not supported." }, 404);
  }
  const userId = c.get("userId");
  const [profile, subscription] = await Promise.all([getProfileRow(c.env.DB, userId), getSubscription(c.env.DB, userId)]);
  if (!profile) return c.json({ code: "PROFILE_NOT_FOUND", message: "Complete your birth profile first." }, 404);
  if (period !== "daily" && !subscription.isPremium) {
    return c.json({ code: "PREMIUM_REQUIRED", message: "This reading is available with complete access." }, 402);
  }

  const key = periodKey(period);
  const cached = await c.env.DB.prepare(
    "SELECT content_json FROM horoscope_cache WHERE user_id = ? AND period = ? AND period_key = ? AND expires_at > ?"
  )
    .bind(userId, period, key, new Date().toISOString())
    .first<{ content_json: string }>();
  let reading = cached ? (JSON.parse(cached.content_json) as ReturnType<typeof generateReading>) : null;
  if (!reading) {
    reading = generateReading(profile, period);
    await c.env.DB.prepare(
      `INSERT INTO horoscope_cache (id, user_id, period, period_key, content_json, calculation_mode, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, period, period_key) DO UPDATE SET
         content_json = excluded.content_json,
         calculation_mode = excluded.calculation_mode,
         expires_at = excluded.expires_at,
         created_at = CURRENT_TIMESTAMP`
    )
      .bind(crypto.randomUUID(), userId, period, key, JSON.stringify(reading), profile.calculation_mode, cacheExpiry(period))
      .run();
  }

  if (!subscription.isPremium) {
    return c.json({
      ...reading,
      luckyColor: undefined,
      luckyColorHex: undefined,
      luckyNumber: undefined,
      mantra: undefined,
      auspiciousTime: undefined,
      cautionTime: undefined,
      remedy: "Take two quiet minutes before an important family conversation.",
      sections: reading.sections.filter((section) => !section.premium).slice(0, 1)
    });
  }
  return c.json(reading);
});

app.get("/birth-chart", async (c) => {
  const userId = c.get("userId");
  const subscription = await getSubscription(c.env.DB, userId);
  if (!subscription.isPremium) return c.json({ code: "PREMIUM_REQUIRED", message: "Birth chart summary requires complete access." }, 402);
  const row = await c.env.DB.prepare("SELECT chart_json FROM birth_details WHERE user_id = ?").bind(userId).first<{ chart_json: string | null }>();
  if (!row?.chart_json) return c.json({ code: "CHART_NOT_FOUND", message: "Complete your birth profile first." }, 404);
  return c.json(JSON.parse(row.chart_json) as ChartResult);
});

app.get("/panchang/today", async (c) => {
  const userId = c.get("userId");
  const [subscription, profile] = await Promise.all([getSubscription(c.env.DB, userId), getProfileRow(c.env.DB, userId)]);
  if (!subscription.isPremium) return c.json({ code: "PREMIUM_REQUIRED", message: "Panchang requires complete access." }, 402);
  if (!profile) return c.json({ code: "PROFILE_NOT_FOUND", message: "Complete your birth profile first." }, 404);
  try {
    return c.json(await calculatePanchang(c.env, profile));
  } catch (error) {
    return c.json({ code: "PANCHANG_PROVIDER_UNAVAILABLE", message: error instanceof Error ? error.message : "Panchang is unavailable." }, 502);
  }
});

app.get("/subscription/status", async (c) => c.json(await getSubscription(c.env.DB, c.get("userId"))));

const verifySubscriptionSchema = z.object({
  platform: z.enum(["android", "ios"]),
  productId: z.string().min(3).max(120)
});

app.post("/subscription/verify", async (c) => {
  const parsed = verifySubscriptionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: "INVALID_PURCHASE", message: "Purchase details are incomplete." }, 400);
  try {
    return c.json(await verifyRevenueCat(c.env, c.get("userId"), parsed.data.platform, parsed.data.productId));
  } catch (error) {
    return c.json({ code: "VERIFICATION_FAILED", message: error instanceof Error ? error.message : "Purchase could not be verified." }, 502);
  }
});

app.post("/subscription/webhook", async (c) => {
  const expected = c.env.REVENUECAT_WEBHOOK_SECRET;
  const supplied = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return c.json({ code: "UNAUTHORIZED_WEBHOOK", message: "Unauthorized." }, 401);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ code: "INVALID_WEBHOOK", message: "Invalid webhook body." }, 400);
  try {
    await processRevenueCatWebhook(c.env, body);
    return c.json({ received: true });
  } catch (error) {
    return c.json({ code: "WEBHOOK_FAILED", message: error instanceof Error ? error.message : "Webhook could not be processed." }, 400);
  }
});

const notificationSchema = z.object({
  pushToken: z.string().min(10).max(300),
  notificationTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});

app.post("/notifications/register", async (c) => {
  const parsed = notificationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ code: "INVALID_NOTIFICATION", message: "Notification details are invalid." }, 400);
  const userId = c.get("userId");
  const profile = await getProfileRow(c.env.DB, userId);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, expo_push_token, notification_time, timezone)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, expo_push_token) DO UPDATE SET
         notification_time = excluded.notification_time,
         timezone = excluded.timezone,
         enabled = 1,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(crypto.randomUUID(), userId, parsed.data.pushToken, parsed.data.notificationTime, profile?.timezone ?? "Asia/Kolkata"),
    c.env.DB.prepare("UPDATE profiles SET notifications_enabled = 1, notification_time = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(parsed.data.notificationTime, userId)
  ]);
  return c.json({ registered: true });
});

app.onError((error, c) => {
  console.error(error);
  return c.json(
    {
      code: "INTERNAL_ERROR",
      message: c.env.ENVIRONMENT === "production" ? "Something went wrong. Please try again." : error.message
    },
    500
  );
});

app.notFound((c) => c.json({ code: "NOT_FOUND", message: "API route not found." }, 404));

async function getProfileRow(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT
        u.id, u.identifier,
        p.full_name, p.gender, p.preferred_language, p.current_city, p.notification_time, p.notifications_enabled,
        b.date_of_birth, b.time_of_birth, b.birth_place, b.timezone, b.latitude, b.longitude,
        b.rashi, b.nakshatra, b.lagna, b.calculation_mode
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       JOIN birth_details b ON b.user_id = u.id
       WHERE u.id = ? AND u.status = 'active'`
    )
    .bind(userId)
    .first<ProfileRow>();
}

function profileJson(row: ProfileRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    identifier: row.identifier,
    gender: row.gender ?? undefined,
    language: row.preferred_language,
    notificationTime: row.notification_time,
    notificationsEnabled: Boolean(row.notifications_enabled),
    birth: {
      dateOfBirth: row.date_of_birth,
      timeOfBirth: row.time_of_birth,
      birthPlace: row.birth_place,
      currentCity: row.current_city ?? undefined,
      timezone: row.timezone,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined
    },
    rashi: row.rashi,
    nakshatra: row.nakshatra,
    lagna: row.lagna
  };
}

function periodKey(period: "daily" | "weekly" | "monthly") {
  const now = new Date();
  if (period === "daily") return now.toISOString().slice(0, 10);
  if (period === "monthly") return now.toISOString().slice(0, 7);
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((now.getTime() - firstDay.getTime()) / 86_400_000 + firstDay.getUTCDay() + 1) / 7);
  return `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function cacheExpiry(period: "daily" | "weekly" | "monthly") {
  const now = new Date();
  if (period === "daily") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  if (period === "weekly") return new Date(now.getTime() + 7 * 86_400_000).toISOString();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export default app;
