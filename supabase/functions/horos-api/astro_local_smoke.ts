import { calculateChart, calculatePanchang } from "./astro.ts";
import type { ProfileInput } from "./types.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateLocalProviderUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  assert(localHosts.has(parsed.hostname), "This smoke test only permits a local Astro provider.");
  assert(parsed.protocol === "http:" || parsed.protocol === "https:", "Unsupported Astro provider protocol.");
}

const providerUrl = requiredEnv("ASTRO_API_URL");
requiredEnv("ASTRO_API_KEY");
const consumerId = requiredEnv("ASTRO_TEST_CONSUMER_ID");
validateLocalProviderUrl(providerUrl);

Deno.env.set("ENVIRONMENT", "development");

const profile: ProfileInput = {
  fullName: "Horos Adapter Smoke",
  language: "English",
  notificationTime: "08:00",
  dateOfBirth: "2000-01-01",
  timeOfBirth: "12:00",
  birthPlace: "Hyderabad",
  timezone: "Asia/Kolkata",
  latitude: 17.385,
  longitude: 78.4867,
  altitudeMeters: 542,
};

const chart = await calculateChart(profile, consumerId);
assert(chart.calculationMode === "provider", "Chart did not use the Astro provider.");
assert(
  chart.calculationProfile === "south_indian_drik_lahiri_jpl_de440s_v1",
  "Chart used an unexpected calculation profile.",
);
assert(Boolean(chart.rashi), "Chart response did not include rashi.");
assert(Boolean(chart.nakshatra), "Chart response did not include nakshatra.");
assert(Boolean(chart.lagna), "Chart response did not include lagna.");
assert(chart.provider.requestId?.startsWith("horos-"), "Chart response did not retain its request ID.");

const panchang = await calculatePanchang(
  {
    localDate: "2026-01-15",
    timezone: "Asia/Kolkata",
    latitude: 17.385,
    longitude: 78.4867,
    altitudeMeters: 542,
    locationLabel: "Hyderabad",
  },
  consumerId,
);
assert(panchang.calculationMode === "provider", "Panchang did not use the Astro provider.");
assert(panchang.date === "2026-01-15", "Panchang returned an unexpected local date.");
assert(Boolean(panchang.tithi), "Panchang response did not include tithi.");
assert(Boolean(panchang.nakshatra), "Panchang response did not include nakshatra.");
assert(Boolean(panchang.sunrise), "Panchang response did not include sunrise.");
assert(Boolean(panchang.sunset), "Panchang response did not include sunset.");
assert(
  panchang.provider.requestId?.startsWith("horos-"),
  "Panchang response did not retain its request ID.",
);
assert(
  panchang.provider.requestId !== chart.provider.requestId,
  "Chart and Panchang requests unexpectedly reused a request ID.",
);

console.log("Horos local Astro adapter smoke passed.");
console.log(`Chart request ID: ${chart.provider.requestId}`);
console.log(`Panchang request ID: ${panchang.provider.requestId}`);
console.log(`Chart summary: ${chart.rashi} / ${chart.nakshatra} / ${chart.lagna}`);
console.log(`Panchang summary: ${panchang.tithi} / ${panchang.nakshatra}`);
