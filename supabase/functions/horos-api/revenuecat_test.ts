import { parseRevenueCatWebhook } from "./revenuecat.ts";
import { subscriptionState } from "./user_flow.ts";
import type { SubscriptionRow } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function subscription(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    platform: null,
    product_id: null,
    provider_customer_id: null,
    status: "expired",
    trial_start_date: null,
    trial_end_date: null,
    subscription_start_date: null,
    subscription_end_date: null,
    ...overrides,
  };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-07-23T00:00:00.000Z");
const FUTURE_EXPIRATION = Date.parse("2026-08-23T00:00:00.000Z");

function lifecycleEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: "evt-renewal-1",
      event_timestamp_ms: NOW,
      type: "RENEWAL",
      app_user_id: USER_ID,
      original_app_user_id: USER_ID,
      aliases: [],
      store: "PLAY_STORE",
      product_id: "horos_premium_monthly",
      purchased_at_ms: NOW,
      expiration_at_ms: FUTURE_EXPIRATION,
      entitlement_ids: ["premium"],
      ...overrides,
    },
  };
}

Deno.test("RevenueCat renewal maps to an active Android entitlement", () => {
  const command = parseRevenueCatWebhook(lifecycleEvent(), "premium", NOW);

  assertEquals(command.status, "active", "renewal status");
  assertEquals(command.priority, 40, "renewal priority");
  assertEquals(command.platform, "android", "renewal platform");
  assertEquals(command.databaseUserId, USER_ID, "renewal user");
  assertEquals(command.processingResult, "applied_active", "renewal result");
});

Deno.test("RevenueCat cancellation keeps access until its expiration", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({ id: "evt-cancel-1", type: "CANCELLATION" }),
    "premium",
    NOW,
  );

  assertEquals(command.status, "cancelled", "cancellation status");
  assertEquals(command.priority, 30, "cancellation priority");
  assertEquals(command.processingResult, "applied_cancelled", "cancellation result");
});

Deno.test("Cancelled subscription remains premium through the paid term", () => {
  const state = subscriptionState(
    subscription({
      status: "cancelled",
      platform: "ios",
      subscription_start_date: "2026-07-01T00:00:00.000Z",
      subscription_end_date: "2026-08-23T00:00:00.000Z",
    }),
    NOW,
  );

  assertEquals(state.access, "active", "cancelled access");
  assertEquals(state.status, "cancelled", "cancelled status");
  assertEquals(state.daysRemaining, 31, "cancelled days remaining");
  assertEquals(state.isPremium, true, "cancelled premium access");
});

Deno.test("Cancelled subscription without a paid-through date is limited", () => {
  const state = subscriptionState(
    subscription({
      status: "cancelled",
      platform: "ios",
      subscription_end_date: null,
    }),
    NOW,
  );

  assertEquals(state.access, "limited", "open-ended cancelled access");
  assertEquals(state.status, "cancelled", "open-ended cancelled status");
  assertEquals(state.isPremium, false, "open-ended cancelled premium access");
});

Deno.test("RevenueCat expiration has higher priority and revokes access", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({ id: "evt-expire-1", type: "EXPIRATION" }),
    "premium",
    NOW,
  );

  assertEquals(command.status, "expired", "expiration status");
  assertEquals(command.priority, 50, "expiration priority");
  assertEquals(command.processingResult, "applied_expired", "expiration result");
});

Deno.test("Product changes are recorded without changing entitlement state", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({ id: "evt-product-1", type: "PRODUCT_CHANGE" }),
    "premium",
    NOW,
  );

  assertEquals(command.status, null, "product change status");
  assertEquals(command.priority, 10, "product change priority");
  assertEquals(command.processingResult, "recorded_informational", "product change result");
});

Deno.test("Webhook parser can recover the Supabase user from RevenueCat aliases", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({
      id: "evt-alias-1",
      app_user_id: "$RCAnonymousID:example",
      original_app_user_id: "$RCAnonymousID:example",
      aliases: [USER_ID],
    }),
    "premium",
    NOW,
  );

  assertEquals(command.appUserId, "$RCAnonymousID:example", "RevenueCat user");
  assertEquals(command.databaseUserId, USER_ID, "database user");
});

Deno.test("Webhook events for another entitlement are ledger-only", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({ id: "evt-other-1", entitlement_ids: ["another_entitlement"] }),
    "premium",
    NOW,
  );

  assertEquals(command.status, null, "unrelated entitlement status");
  assertEquals(command.priority, 0, "unrelated entitlement priority");
  assertEquals(command.processingResult, "ignored_entitlement", "unrelated entitlement result");
});

Deno.test("Temporary grants without expiry are capped at 24 hours", () => {
  const command = parseRevenueCatWebhook(
    lifecycleEvent({
      id: "evt-temp-1",
      type: "TEMPORARY_ENTITLEMENT_GRANT",
      expiration_at_ms: undefined,
      purchased_at_ms: undefined,
    }),
    "premium",
    NOW,
  );

  assertEquals(command.status, "active", "temporary grant status");
  assertEquals(
    command.expiresAt,
    new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
    "temporary grant expiry",
  );
});
