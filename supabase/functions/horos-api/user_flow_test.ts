import { ResponseError } from "./errors.ts";
import { parseProfileInput, parseProfileUpdate, subscriptionState } from "./user_flow.ts";
import type { SubscriptionRow } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function expectResponseError(
  action: () => unknown,
  code: string,
  message: string,
): void {
  try {
    action();
  } catch (error) {
    if (error instanceof ResponseError && error.code === code) return;
    throw new Error(`${message}: received an unexpected error`);
  }
  throw new Error(`${message}: expected ${code}`);
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

const NOW = Date.parse("2026-07-22T00:00:00Z");

Deno.test("Onboarding accepts and normalizes a valid Indian birth profile", () => {
  const profile = parseProfileInput(
    {
      fullName: "  Private Beta User  ",
      gender: "  Prefer not to say  ",
      language: "English",
      notificationTime: "07:30",
      dateOfBirth: "1998-10-26",
      timeOfBirth: "10:28",
      birthPlace: "  Nagarjuna Sagar  ",
      currentCity: "  Hyderabad  ",
      timezone: "Asia/Kolkata",
      latitude: 16.575,
      longitude: 79.312,
    },
    NOW,
  );

  assertEquals(profile.fullName, "Private Beta User", "full name");
  assertEquals(profile.birthPlace, "Nagarjuna Sagar", "birth place");
  assertEquals(profile.currentCity, "Hyderabad", "current city");
  assertEquals(profile.altitudeMeters, 0, "default altitude");
});

Deno.test("Onboarding rejects invalid timezone and coordinates", () => {
  const base = {
    fullName: "Private Beta User",
    language: "English",
    notificationTime: "07:30",
    dateOfBirth: "1998-10-26",
    timeOfBirth: "10:28",
    birthPlace: "Nagarjuna Sagar",
    timezone: "Asia/Kolkata",
    latitude: 16.575,
    longitude: 79.312,
  };

  expectResponseError(
    () => parseProfileInput({ ...base, timezone: "Invalid/Timezone" }, NOW),
    "INVALID_TIMEZONE",
    "invalid timezone",
  );
  expectResponseError(
    () => parseProfileInput({ ...base, latitude: 91 }, NOW),
    "COORDINATES_REQUIRED",
    "invalid latitude",
  );
});

Deno.test("Onboarding rejects future birth dates deterministically", () => {
  expectResponseError(
    () =>
      parseProfileInput(
        {
          fullName: "Private Beta User",
          language: "English",
          notificationTime: "07:30",
          dateOfBirth: "2026-08-01",
          timeOfBirth: "10:28",
          birthPlace: "Nagarjuna Sagar",
          timezone: "Asia/Kolkata",
          latitude: 16.575,
          longitude: 79.312,
        },
        NOW,
      ),
    "INVALID_BIRTH_DATE",
    "future birth date",
  );
});

Deno.test("Profile updates normalize supported fields", () => {
  const update = parseProfileUpdate({
    fullName: "  Updated User  ",
    language: "Telugu",
    notificationTime: "19:15",
    notificationsEnabled: true,
    currentCity: "  Secunderabad  ",
  });

  assertEquals(update.full_name, "Updated User", "updated full name");
  assertEquals(update.preferred_language, "Telugu", "updated language");
  assertEquals(update.notification_time, "19:15", "updated notification time");
  assertEquals(update.notifications_enabled, true, "notification preference");
  assertEquals(update.current_city, "Secunderabad", "updated city");
});

Deno.test("Active trial grants premium access", () => {
  const state = subscriptionState(
    subscription({
      status: "trial",
      trial_start_date: "2026-07-01T00:00:00Z",
      trial_end_date: "2026-07-25T00:00:00Z",
    }),
    NOW,
  );

  assertEquals(state.access, "trial", "trial access");
  assertEquals(state.status, "trial", "trial status");
  assertEquals(state.daysRemaining, 3, "trial days remaining");
  assertEquals(state.isPremium, true, "trial premium access");
});

Deno.test("Active paid entitlement grants premium access", () => {
  const state = subscriptionState(
    subscription({
      status: "active",
      platform: "android",
      product_id: "daily_vedic_astro_monthly_10",
      subscription_start_date: "2026-07-01T00:00:00Z",
      subscription_end_date: "2026-08-22T00:00:00Z",
    }),
    NOW,
  );

  assertEquals(state.access, "active", "paid access");
  assertEquals(state.status, "active", "paid status");
  assertEquals(state.daysRemaining, 31, "paid days remaining");
  assertEquals(state.isPremium, true, "paid premium access");
});

Deno.test("Expired trial becomes limited and reports expired status", () => {
  const state = subscriptionState(
    subscription({
      status: "trial",
      trial_start_date: "2026-06-01T00:00:00Z",
      trial_end_date: "2026-07-01T00:00:00Z",
    }),
    NOW,
  );

  assertEquals(state.access, "limited", "expired trial access");
  assertEquals(state.status, "expired", "expired trial status");
  assertEquals(state.daysRemaining, 0, "expired trial days");
  assertEquals(state.isPremium, false, "expired trial premium access");
});

Deno.test("Cancelled subscription remains limited and reports cancellation", () => {
  const state = subscriptionState(
    subscription({
      status: "cancelled",
      platform: "ios",
      subscription_end_date: "2026-07-20T00:00:00Z",
    }),
    NOW,
  );

  assertEquals(state.access, "limited", "cancelled access");
  assertEquals(state.status, "cancelled", "cancelled status");
  assertEquals(state.isPremium, false, "cancelled premium access");
});
