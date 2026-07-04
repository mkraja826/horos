import type { Bindings, SubscriptionRow } from "./types";

export function subscriptionState(row: SubscriptionRow | null) {
  const now = Date.now();
  const trialEnd = row?.trial_end_date ? new Date(row.trial_end_date).getTime() : 0;
  const subscriptionEnd = row?.subscription_end_date ? new Date(row.subscription_end_date).getTime() : 0;
  const trialActive = row?.status === "trial" && trialEnd > now;
  const paidActive = row?.status === "active" && (!subscriptionEnd || subscriptionEnd > now);
  const end = trialActive ? trialEnd : paidActive ? subscriptionEnd : 0;

  return {
    access: trialActive ? "trial" : paidActive ? "active" : "limited",
    status: trialActive ? "trial" : paidActive ? "active" : row?.status ?? "expired",
    trialEndsAt: row?.trial_end_date ?? undefined,
    subscriptionEndsAt: row?.subscription_end_date ?? undefined,
    daysRemaining: end ? Math.max(0, Math.ceil((end - now) / 86_400_000)) : 0,
    isPremium: trialActive || paidActive
  };
}

export async function getSubscription(db: D1Database, userId: string) {
  const row = await db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").bind(userId).first<SubscriptionRow>();
  const state = subscriptionState(row ?? null);
  if (row && !state.isPremium && (row.status === "trial" || row.status === "active")) {
    await db.prepare("UPDATE subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(userId).run();
  }
  return state;
}

type RevenueCatSubscriber = {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string; purchase_date?: string }>;
  };
};

export async function verifyRevenueCat(env: Bindings, userId: string, platform: "android" | "ios", requestedProductId: string) {
  if (!env.REVENUECAT_SECRET_KEY) throw new Error("Subscription verification is not configured.");
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}`, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("The store entitlement could not be verified.");
  const body = (await response.json()) as RevenueCatSubscriber;
  const entitlementId = env.REVENUECAT_ENTITLEMENT_ID || "premium";
  const entitlement = body.subscriber?.entitlements?.[entitlementId];
  const expiresAt = entitlement?.expires_date ?? null;
  const active = Boolean(entitlement && (!expiresAt || new Date(expiresAt).getTime() > Date.now()));

  await env.DB.prepare(
    `INSERT INTO subscriptions
      (user_id, platform, product_id, provider_customer_id, status, subscription_start_date, subscription_end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       platform = excluded.platform,
       product_id = excluded.product_id,
       provider_customer_id = excluded.provider_customer_id,
       status = excluded.status,
       subscription_start_date = excluded.subscription_start_date,
       subscription_end_date = excluded.subscription_end_date,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      userId,
      platform,
      entitlement?.product_identifier ?? requestedProductId,
      userId,
      active ? "active" : "expired",
      entitlement?.purchase_date ?? new Date().toISOString(),
      expiresAt
    )
    .run();
  return getSubscription(env.DB, userId);
}

export async function processRevenueCatWebhook(env: Bindings, body: Record<string, unknown>) {
  const event = (body.event ?? {}) as Record<string, unknown>;
  const userId = String(event.app_user_id ?? "");
  if (!userId) throw new Error("Webhook event has no app user id.");
  const eventId = String(event.id ?? crypto.randomUUID());
  const type = String(event.type ?? "");
  const isActive = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "TEMPORARY_ENTITLEMENT_GRANT"].includes(type);
  const isCancelled = type === "CANCELLATION";
  const expiration = typeof event.expiration_at_ms === "number" ? new Date(event.expiration_at_ms).toISOString() : null;
  const store = String(event.store ?? "").toLowerCase();
  const platform = store.includes("apple") ? "ios" : "android";

  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO webhook_events (id, provider, payload_json) VALUES (?, 'revenuecat', ?)").bind(eventId, JSON.stringify(body)),
    env.DB.prepare(
      `INSERT INTO subscriptions (user_id, platform, product_id, provider_customer_id, status, subscription_start_date, subscription_end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         platform = excluded.platform,
         product_id = excluded.product_id,
         provider_customer_id = excluded.provider_customer_id,
         status = excluded.status,
         subscription_end_date = excluded.subscription_end_date,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      userId,
      platform,
      String(event.product_id ?? ""),
      userId,
      isActive ? "active" : isCancelled ? "cancelled" : "expired",
      new Date().toISOString(),
      expiration
    )
  ]);
}
