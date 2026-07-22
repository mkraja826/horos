import type { User } from "supabase";

import { calculateChart } from "./astro.ts";
import {
  adminClient,
  getProfileRows,
  getSubscription,
  identifierHash,
  profileJson,
  ResponseError,
  userIdentifier,
} from "./db.ts";
import { parseProfileInput, parseProfileUpdate } from "./user_flow.ts";

export async function createProfile(user: User, body: Record<string, unknown>) {
  const input = parseProfileInput(body);
  const chart = await calculateChart(input, user.id);

  const profileResult = await adminClient.from("profiles").upsert(
    {
      user_id: user.id,
      full_name: input.fullName,
      gender: input.gender ?? null,
      preferred_language: input.language,
      current_city: input.currentCity ?? null,
      notification_time: input.notificationTime,
    },
    { onConflict: "user_id" },
  );
  if (profileResult.error) throw profileResult.error;

  const birthResult = await adminClient.from("birth_details").upsert(
    {
      user_id: user.id,
      date_of_birth: input.dateOfBirth,
      time_of_birth: input.timeOfBirth,
      birth_place: input.birthPlace,
      timezone: input.timezone,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude_meters: input.altitudeMeters ?? 0,
      rashi: chart.rashi,
      nakshatra: chart.nakshatra,
      lagna: chart.lagna,
      chart_json: chart,
      calculation_profile: chart.calculationProfile,
      calculation_mode: "provider",
    },
    { onConflict: "user_id" },
  );
  if (birthResult.error) throw birthResult.error;

  const clearCache = await adminClient.from("horoscope_cache").delete().eq("user_id", user.id);
  if (clearCache.error) throw clearCache.error;

  const hash = await identifierHash(userIdentifier(user));
  const trial = await adminClient.rpc("claim_horos_trial_v1", {
    p_user_id: user.id,
    p_identifier_hash: hash,
  });
  if (trial.error) throw trial.error;

  const rows = await getProfileRows(user.id);
  if (!rows) throw new ResponseError("The profile could not be loaded after creation.", 500, "PROFILE_WRITE_FAILED");
  return {
    profile: profileJson(user, rows),
    subscription: await getSubscription(user.id),
  };
}

export async function readProfile(user: User) {
  const rows = await getProfileRows(user.id);
  if (!rows) {
    throw new ResponseError("Complete your birth profile first.", 404, "PROFILE_NOT_FOUND");
  }
  return { profile: profileJson(user, rows) };
}

export async function updateProfile(user: User, body: Record<string, unknown>) {
  const update = parseProfileUpdate(body);
  if (Object.keys(update).length) {
    const result = await adminClient.from("profiles").update(update).eq("user_id", user.id);
    if (result.error) throw result.error;
  }
  return readProfile(user);
}

export async function deleteAccount(user: User) {
  const result = await adminClient.auth.admin.deleteUser(user.id);
  if (result.error) throw result.error;
  return { deleted: true as const };
}
