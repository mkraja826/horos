import { ResponseError } from "./errors.ts";

export type RevenueCatWebhookStatus = "active" | "cancelled" | "expired" | null;

export type RevenueCatWebhookCommand = {
  eventId: string;
  eventTimestampMs: number;
  eventType: string;
  appUserId: string | null;
  databaseUserId: string | null;
  platform: "android" | "ios" | null;
  productId: string | null;
  status: RevenueCatWebhookStatus;
  priority: number;
  purchasedAt: string | null;
  expiresAt: string | null;
  processingResult: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
const INFORMATIONAL_EVENT_TYPES = new Set([
  "TEST",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_PAUSED",
  "INVOICE_ISSUANCE",
  "TRANSFER",
  "SUBSCRIBER_ALIAS",
  "PRICE_INCREASE_CONSENT_REQUIRED",
  "PRICE_INCREASE_CONSENT_APPROVED",
  "EXPERIMENT_ENROLLMENT",
  "PURCHASE_REDEEMED",
  "VIRTUAL_CURRENCY_TRANSACTION",
  "PAYWALL_IMPRESSION",
  "PAYWALL_CLOSE",
  "PAYWALL_CANCEL",
  "PAYWALL_EXIT_OFFER",
  "PAYWALL_COMPONENT_INTERACTED",
]);

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResponseError("Webhook event is invalid.", 400, "INVALID_WEBHOOK");
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ResponseError(`Webhook ${field} is missing.`, 400, "INVALID_WEBHOOK");
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredTimestamp(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ResponseError(`Webhook ${field} is invalid.`, 400, "INVALID_WEBHOOK");
  }
  return value;
}

function optionalTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isoTimestamp(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());
}

function platformForStore(value: unknown): "android" | "ios" | null {
  const store = optionalText(value)?.toUpperCase();
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "ios";
  if (store === "PLAY_STORE") return "android";
  return null;
}

function databaseUserId(event: Record<string, unknown>, appUserId: string | null): string | null {
  const candidates = [
    appUserId,
    optionalText(event.original_app_user_id),
    ...stringArray(event.aliases),
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && UUID_PATTERN.test(candidate))) ?? null;
}

function entitlementMatches(event: Record<string, unknown>, entitlementId: string): boolean {
  const ids = stringArray(event.entitlement_ids);
  return ids.length === 0 || ids.includes(entitlementId);
}

export function parseRevenueCatWebhook(
  body: Record<string, unknown>,
  entitlementId: string,
  nowMilliseconds = Date.now(),
): RevenueCatWebhookCommand {
  const event = objectValue(body.event);
  const eventId = requiredText(event.id, "event id");
  const eventTimestampMs = requiredTimestamp(event.event_timestamp_ms, "timestamp");
  const eventType = requiredText(event.type, "type").toUpperCase();
  const appUserId = optionalText(event.app_user_id);
  const userId = databaseUserId(event, appUserId);
  const platform = platformForStore(event.store);
  const productId = optionalText(event.product_id);
  const purchasedAtMs = optionalTimestamp(event.purchased_at_ms);
  let expirationAtMs = optionalTimestamp(event.expiration_at_ms);

  if (eventType === "TEMPORARY_ENTITLEMENT_GRANT" && expirationAtMs === null) {
    expirationAtMs = eventTimestampMs + 24 * 60 * 60 * 1000;
  }

  const base = {
    eventId,
    eventTimestampMs,
    eventType,
    appUserId,
    databaseUserId: userId,
    platform,
    productId,
    purchasedAt: isoTimestamp(purchasedAtMs),
    expiresAt: isoTimestamp(expirationAtMs),
  };

  if (!entitlementMatches(event, entitlementId)) {
    return {
      ...base,
      status: null,
      priority: 0,
      processingResult: "ignored_entitlement",
    };
  }

  if (eventType === "EXPIRATION") {
    return {
      ...base,
      status: "expired",
      priority: 50,
      processingResult: "applied_expired",
    };
  }

  if (eventType === "CANCELLATION") {
    const expired = expirationAtMs === null || expirationAtMs <= nowMilliseconds;
    return {
      ...base,
      status: expired ? "expired" : "cancelled",
      priority: expired ? 50 : 30,
      processingResult: expired ? "applied_expired" : "applied_cancelled",
    };
  }

  if (ACTIVE_EVENT_TYPES.has(eventType)) {
    const expired = expirationAtMs !== null && expirationAtMs <= nowMilliseconds;
    return {
      ...base,
      status: expired ? "expired" : "active",
      priority: 40,
      processingResult: expired ? "applied_expired" : "applied_active",
    };
  }

  return {
    ...base,
    status: null,
    priority: INFORMATIONAL_EVENT_TYPES.has(eventType) ? 10 : 0,
    processingResult: INFORMATIONAL_EVENT_TYPES.has(eventType)
      ? "recorded_informational"
      : "ignored_event_type",
  };
}
