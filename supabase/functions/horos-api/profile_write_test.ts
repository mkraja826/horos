import { buildProfileWriteArguments } from "./profile_write.ts";
import type { ChartResult, ProfileInput } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const input: ProfileInput = {
  fullName: "Karthik Raja",
  language: "English",
  notificationTime: "06:30",
  dateOfBirth: "1998-10-26",
  timeOfBirth: "10:28",
  birthPlace: "Nagarjuna Sagar",
  timezone: "Asia/Kolkata",
  latitude: 16.575,
  longitude: 79.312,
};

const chart: ChartResult = {
  rashi: "Dhanu",
  nakshatra: "Mula",
  lagna: "Dhanu",
  birthStar: "Mula – Pada 1",
  element: "Fire",
  nature: "Calculated placements only; interpretation is not enabled.",
  strengths: [],
  challenges: [],
  lifestyleBalance: "This chart is a calculation reference, not a guaranteed prediction.",
  planetaryPositions: { moon: 241.5 },
  calculationMode: "provider",
  calculationProfile: "south_indian_drik_lahiri_jpl_de440s_v1",
  ayanamshaDegrees: 23.8,
  provider: {
    engine: "jyothisyam",
    astronomicalProvider: "skyfield_jpl_de440s",
    requestId: "horos-test-request",
  },
  rawPositions: { planets: [] },
};

Deno.test("Atomic profile RPC receives the complete profile and chart contract", () => {
  const args = buildProfileWriteArguments(
    "11111111-1111-4111-8111-111111111111",
    "a".repeat(64),
    input,
    chart,
  );

  assertEquals(Object.keys(args).sort(), [
    "p_altitude_meters",
    "p_birth_place",
    "p_calculation_mode",
    "p_calculation_profile",
    "p_chart_json",
    "p_current_city",
    "p_date_of_birth",
    "p_full_name",
    "p_gender",
    "p_identifier_hash",
    "p_lagna",
    "p_latitude",
    "p_longitude",
    "p_nakshatra",
    "p_notification_time",
    "p_preferred_language",
    "p_rashi",
    "p_time_of_birth",
    "p_timezone",
    "p_user_id",
  ], "RPC argument names");
  assertEquals(args.p_gender, null, "optional gender");
  assertEquals(args.p_current_city, null, "optional city");
  assertEquals(args.p_altitude_meters, 0, "default altitude");
  assertEquals(args.p_chart_json, chart, "chart payload");
  assertEquals(args.p_calculation_mode, "provider", "calculation mode");
});

Deno.test("Atomic profile RPC preserves optional values", () => {
  const args = buildProfileWriteArguments(
    "11111111-1111-4111-8111-111111111111",
    "b".repeat(64),
    {
      ...input,
      gender: "Male",
      currentCity: "Hyderabad",
      altitudeMeters: 120,
    },
    chart,
  );

  assertEquals(args.p_gender, "Male", "gender");
  assertEquals(args.p_current_city, "Hyderabad", "city");
  assertEquals(args.p_altitude_meters, 120, "altitude");
});
