import { adminClient, getSubscription, ResponseError } from "./db.ts";

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ResponseError("Subscription verification is not configured.", 503, "SUBSCRIPTION_NOT_CONFIGURED");
  return value;
}

type RevenueCatSubscriber = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        product_identifier?: string;
        purchase_date?: string;
      }
    >;
  };
};

export async function verifyRevenueCat(
  userId: string,
  platform: "android" | "ios",
  requestedProductId: string,
) {
  const secret = requiredSecret("REVENUECAT_SECRET_KEY");
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new ResponseError(
      "The store entitlement could not be verified.",
      502,
      "VERIFICATION_FAILED",
    );
  }

  const body = (await response.json()) as RevenueCatSubscriber;
  const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID")?.trim() || "premium";
  const entitlement = body.subscriber?.entitlements?.[entitlementId];
  const expiresAt = entitlement?.expires_date ?? null;
  const active = Boolean(entitlement && (!expiresAt || new Date(expiresAt).getTime() > Date.now()));
  const result = await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      platform,
      product_id: entitlement?.product_identifier ?? requestedProductId,
      provider_customer_id: userId,
      status: active ? "active" : "expired",
      subscription_start_date: entitlement?.purchase_date ?? new Date().toISOString(),
      subscription_end_date: expiresAt,
    },
    { onConflict: "user_id" },
  );
  if (result.error) throw result.error;
  return getSubscription(userId);
}

export async function processRevenueCatWebhook(body: Record<string, unknown>) {
  const event = (body.event ?? {}) as Record<string, unknown>;
  const userId = String(event.app_user_id ?? "");
  if (!userId) {
    throw new ResponseError("Webhook event has no app user id.", 400, "INVALID_WEBHOOK");
  }

  const eventId = String(event.id ?? crypto.randomUUID());
  const type = String(event.type ?? "");
  const activeTypes = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "TEMPORARY_ENTITLEMENT_GRANT",
  ];
  const isActive = activeTypes.includes(type);
  const isCancelled = type === "CANCELLATION";
  const expiration = typeof event.expiration_at_ms === "number"
    ? new Date(event.expiration_at_ms).toISOString()
    : null;
  const store = String(event.store ?? "").toLowerCase();
  const platform = store.includes("apple") ? "ios" : "android";

  const eventResult = await adminClient.from("webhook_events").upsert(
    { id: eventId, provider: "revenuecat", payload_json: body },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (eventResult.error) throw eventResult.error;

  const subscriptionResult = await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      platform,
      product_id: String(event.product_id ?? ""),
      provider_customer_id: userId,
      status: isActive ? "active" : isCancelled ? "cancelled" : "expired",
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: expiration,
    },
    { onConflict: "user_id" },
  );
  if (subscriptionResult.error) throw subscriptionResult.error;
}

export function verifyWebhookAuthorization(request: Request): void {
  const expected = requiredSecret("REVENUECAT_WEBHOOK_SECRET");
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== expected) {
    throw new ResponseError("Unauthorized.", 401, "UNAUTHORIZED_WEBHOOK");
  }
}
