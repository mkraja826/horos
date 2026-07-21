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
import type { Language, ProfileInput } from "./types.ts";

const LANGUAGES = new Set<Language>(["English", "Hindi", "Telugu"]);

function requiredString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new ResponseError(`${field} is required.`, 400, "INVALID_PROFILE");
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ResponseError(`${field} is not valid.`, 400, "INVALID_PROFILE");
  }
  return normalized;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ResponseError("One of the optional profile values is not valid.", 400, "INVALID_PROFILE");
  }
  return value.trim();
}

function numberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ResponseError(`${field} is required for an accurate chart.`, 400, "COORDINATES_REQUIRED");
  }
  return value;
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseProfileInput(body: Record<string, unknown>): ProfileInput {
  const dateOfBirth = requiredString(body.dateOfBirth, "Date of birth", 10, 10);
  const timeOfBirth = requiredString(body.timeOfBirth, "Time of birth", 5, 5);
  const timezone = requiredString(body.timezone, "Birth timezone", 3, 80);
  const language = requiredString(body.language, "Language", 2, 20) as Language;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new ResponseError("Date of birth must use YYYY-MM-DD.", 400, "INVALID_BIRTH_DATE");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfBirth)) {
    throw new ResponseError("Time of birth must use HH:MM.", 400, "INVALID_BIRTH_TIME");
  }
  if (!validTimezone(timezone)) {
    throw new ResponseError("Enter a valid IANA birth timezone.", 400, "INVALID_TIMEZONE");
  }
  if (!LANGUAGES.has(language)) {
    throw new ResponseError("The selected language is not supported.", 400, "INVALID_PROFILE");
  }
  const notificationTime = requiredString(body.notificationTime, "Notification time", 5, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(notificationTime)) {
    throw new ResponseError("Notification time must use HH:MM.", 400, "INVALID_PROFILE");
  }

  const approximateBirth = new Date(`${dateOfBirth}T${timeOfBirth}:00Z`);
  if (Number.isNaN(approximateBirth.getTime()) || approximateBirth.getTime() > Date.now() + 86_400_000) {
    throw new ResponseError("Birth date cannot be in the future.", 400, "INVALID_BIRTH_DATE");
  }

  return {
    fullName: requiredString(body.fullName, "Full name", 2, 100),
    gender: optionalString(body.gender, 30),
    language,
    notificationTime,
    dateOfBirth,
    timeOfBirth,
    birthPlace: requiredString(body.birthPlace, "Birth place", 2, 180),
    currentCity: optionalString(body.currentCity, 120),
    timezone,
    latitude: numberInRange(body.latitude, "Birth latitude", -90, 90),
    longitude: numberInRange(body.longitude, "Birth longitude", -180, 180),
    altitudeMeters:
      body.altitudeMeters === undefined
        ? 0
        : numberInRange(body.altitudeMeters, "Birth altitude", -500, 10_000),
  };
}

export async function createProfile(user: User, body: Record<string, unknown>) {
  const input = parseProfileInput(body);
  const chart = await calculateChart(input);

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
  const update: Record<string, unknown> = {};
  if (body.fullName !== undefined) update.full_name = requiredString(body.fullName, "Full name", 2, 100);
  if (body.gender !== undefined) update.gender = optionalString(body.gender, 30) ?? null;
  if (body.language !== undefined) {
    const language = requiredString(body.language, "Language", 2, 20) as Language;
    if (!LANGUAGES.has(language)) {
      throw new ResponseError("The selected language is not supported.", 400, "INVALID_PROFILE_UPDATE");
    }
    update.preferred_language = language;
  }
  if (body.notificationTime !== undefined) {
    const time = requiredString(body.notificationTime, "Notification time", 5, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new ResponseError("Notification time must use HH:MM.", 400, "INVALID_PROFILE_UPDATE");
    }
    update.notification_time = time;
  }
  if (body.notificationsEnabled !== undefined) {
    if (typeof body.notificationsEnabled !== "boolean") {
      throw new ResponseError("Notification preference is not valid.", 400, "INVALID_PROFILE_UPDATE");
    }
    update.notifications_enabled = body.notificationsEnabled;
  }
  if (body.currentCity !== undefined) update.current_city = optionalString(body.currentCity, 120) ?? null;

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
