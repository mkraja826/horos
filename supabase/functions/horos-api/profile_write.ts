import type { ChartResult, ProfileInput } from "./types.ts";

export type ProfileWriteArguments = {
  p_user_id: string;
  p_identifier_hash: string;
  p_full_name: string;
  p_gender: string | null;
  p_preferred_language: string;
  p_current_city: string | null;
  p_notification_time: string;
  p_date_of_birth: string;
  p_time_of_birth: string;
  p_birth_place: string;
  p_timezone: string;
  p_latitude: number;
  p_longitude: number;
  p_altitude_meters: number;
  p_rashi: string;
  p_nakshatra: string;
  p_lagna: string;
  p_chart_json: ChartResult;
  p_calculation_profile: string;
  p_calculation_mode: "provider";
};

export function buildProfileWriteArguments(
  userId: string,
  identifierHash: string,
  input: ProfileInput,
  chart: ChartResult,
): ProfileWriteArguments {
  return {
    p_user_id: userId,
    p_identifier_hash: identifierHash,
    p_full_name: input.fullName,
    p_gender: input.gender ?? null,
    p_preferred_language: input.language,
    p_current_city: input.currentCity ?? null,
    p_notification_time: input.notificationTime,
    p_date_of_birth: input.dateOfBirth,
    p_time_of_birth: input.timeOfBirth,
    p_birth_place: input.birthPlace,
    p_timezone: input.timezone,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_altitude_meters: input.altitudeMeters ?? 0,
    p_rashi: chart.rashi,
    p_nakshatra: chart.nakshatra,
    p_lagna: chart.lagna,
    p_chart_json: chart,
    p_calculation_profile: chart.calculationProfile,
    p_calculation_mode: "provider",
  };
}
