import { cacheExpiry, periodKey } from "./periods.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("Daily horoscope key follows India local midnight", () => {
  assertEquals(
    periodKey("daily", "Asia/Kolkata", new Date("2026-07-23T18:45:00.000Z")),
    "2026-07-24",
    "India daily key",
  );
});

Deno.test("Daily horoscope key does not advance early in western timezones", () => {
  assertEquals(
    periodKey("daily", "America/New_York", new Date("2026-07-24T02:00:00.000Z")),
    "2026-07-23",
    "New York daily key",
  );
});

Deno.test("Weekly horoscope key uses the ISO week year", () => {
  assertEquals(
    periodKey("weekly", "Asia/Kolkata", new Date("2027-01-01T12:00:00.000Z")),
    "2026-W53",
    "ISO week-year boundary",
  );
});

Deno.test("Daily cache expires at the next India local midnight", () => {
  assertEquals(
    cacheExpiry("daily", "Asia/Kolkata", new Date("2026-07-23T12:00:00.000Z")),
    "2026-07-23T18:30:00.000Z",
    "India daily expiry",
  );
});

Deno.test("Weekly cache expires at the next local Monday", () => {
  assertEquals(
    cacheExpiry("weekly", "Asia/Kolkata", new Date("2026-07-23T12:00:00.000Z")),
    "2026-07-26T18:30:00.000Z",
    "India weekly expiry",
  );
});

Deno.test("Daily cache expiry respects daylight-saving offsets", () => {
  assertEquals(
    cacheExpiry("daily", "America/New_York", new Date("2026-03-08T16:00:00.000Z")),
    "2026-03-09T04:00:00.000Z",
    "New York DST expiry",
  );
});

Deno.test("Monthly cache expires at the next local month boundary", () => {
  assertEquals(
    cacheExpiry("monthly", "Asia/Kolkata", new Date("2026-07-23T12:00:00.000Z")),
    "2026-07-31T18:30:00.000Z",
    "India monthly expiry",
  );
});
