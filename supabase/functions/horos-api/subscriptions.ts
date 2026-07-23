import { adminClient, getSubscription, ResponseError } from "./db.ts";
import { parseRevenueCatWebhook } from "./revenuecat.ts";

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
  const verifiedAt = Date.now();
  const result = await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      platform,
      product_id: entitlement?.product_identifier ?? requestedProductId,
      provider_customer_id: userId,
      status: active ? "active" : "expired",
      subscription_start_date: entitlement?.purchase_date ?? new Date(verifiedAt).toISOString(),
      subscription_end_date: expiresAt,
      provider_event_timestamp_ms: verifiedAt,
      provider_event_priority: 100,
      provider_event_id: `verify-${crypto.randomUUID()}`,
    },
    { onConflict: "user_id" },
  );
  if (result.error) throw result.error;
  return getSubscription(userId);
}

export async function processRevenueCatWebhook(body: Record<string, unknown>) {
  const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID")?.trim() || "premium";
  const command = parseRevenueCatWebhook(body, entitlementId);
  const result = await adminClient.rpc("process_revenuecat_webhook_v1", {
    p_event_id: command.eventId,
    p_event_timestamp_ms: command.eventTimestampMs,
    p_event_priority: command.priority,
    p_event_type: command.eventType,
    p_app_user_id: command.appUserId,
    p_user_id: command.databaseUserId,
    p_platform: command.platform,
    p_product_id: command.productId,
    p_status: command.status,
    p_purchased_at: command.purchasedAt,
    p_expires_at: command.expiresAt,
    p_payload: body,
    p_processing_result: command.processingResult,
  });
  if (result.error) throw result.error;
  return result.data ?? { processed: false, reason: "no_result", eventId: command.eventId };
}

export function verifyWebhookAuthorization(request: Request): void {
  const expected = requiredSecret("REVENUECAT_WEBHOOK_SECRET");
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== expected) {
    throw new ResponseError("Unauthorized.", 401, "UNAUTHORIZED_WEBHOOK");
  }
}
