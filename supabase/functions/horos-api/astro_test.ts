import {
  buildAstroProviderHeaders,
  formatTithiLabel,
  localDateTimeInTimezone,
  normalizeBirthTime,
} from "./astro.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("Astro provider headers authenticate and meter the Horos user", () => {
  const apiKey = "astro-service-key-test-only";
  const consumerId = "11111111-1111-4111-8111-111111111111";
  const requestId = "horos-22222222-2222-4222-8222-222222222222";
  const headers = new Headers(buildAstroProviderHeaders(apiKey, consumerId, requestId));

  assertEquals(headers.get("authorization"), `Bearer ${apiKey}`, "authorization header");
  assertEquals(headers.get("x-astro-consumer-id"), consumerId, "consumer header");
  assertEquals(headers.get("x-request-id"), requestId, "request ID header");
  assertEquals(headers.get("content-type"), "application/json", "content type");
});

Deno.test("Astro provider headers do not expose Supabase server credentials", () => {
  const serialized = JSON.stringify(
    Object.fromEntries(
      new Headers(
        buildAstroProviderHeaders(
          "astro-service-key-test-only",
          "11111111-1111-4111-8111-111111111111",
          "horos-33333333-3333-4333-8333-333333333333",
        ),
      ).entries(),
    ),
  );

  if (serialized.includes("sb_secret_") || serialized.includes("service_role")) {
    throw new Error("Supabase server credentials must never be forwarded to the Astro API.");
  }
});

Deno.test("Panchang Tithi label does not repeat an included Paksha", () => {
  assertEquals(
    formatTithiLabel("Krishna", "Krishna Dwadashi"),
    "Krishna Dwadashi",
    "included Paksha",
  );
});

Deno.test("Panchang Tithi label adds a missing Paksha", () => {
  assertEquals(
    formatTithiLabel("Shukla", "Navami"),
    "Shukla Navami",
    "missing Paksha",
  );
});

Deno.test("Panchang Tithi label normalizes whitespace and casing safely", () => {
  assertEquals(
    formatTithiLabel("  Krishna  ", "krishna   Dwadashi"),
    "krishna Dwadashi",
    "normalized duplicate Paksha",
  );
});


Deno.test("Prediction query instant is serialized in the birth timezone", () => {
  assertEquals(
    localDateTimeInTimezone("Asia/Kolkata", new Date("2026-07-23T06:30:15.000Z")),
    "2026-07-23T12:00:15",
    "local prediction instant",
  );
});


Deno.test("Prediction birth time accepts profile input and PostgreSQL time formats", () => {
  assertEquals(normalizeBirthTime("10:28"), "10:28:00", "profile HH:MM");
  assertEquals(normalizeBirthTime("10:28:00"), "10:28:00", "database HH:MM:SS");
  assertEquals(normalizeBirthTime("10:28:00.000000"), "10:28:00", "database fractional seconds");
});
