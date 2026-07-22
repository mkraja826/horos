import { ResponseError } from "./errors.ts";
import type { Language, ProfileInput, SubscriptionRow } from "./types.ts";

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

function supportedLanguage(value: unknown): Language {
  const language = requiredString(value, "Language", 2, 20) as Language;
  if (!LANGUAGES.has(language)) {
    throw new ResponseError("The selected language is not supported.", 400, "INVALID_PROFILE");
  }
  return language;
}

function notificationTime(value: unknown, code = "INVALID_PROFILE"): string {
  const time = requiredString(value, "Notification time", 5, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ResponseError("Notification time must use HH:MM.", 400, code);
  }
  return time;
}

export function parseProfileInput(
  body: Record<string, unknown>,
  nowMilliseconds = Date.now(),
): ProfileInput {
  const dateOfBirth = requiredString(body.dateOfBirth, "Date of birth", 10, 10);
  const timeOfBirth = requiredString(body.timeOfBirth, "Time of birth", 5, 5);
  const timezone = requiredString(body.timezone, "Birth timezone", 3, 80);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new ResponseError("Date of birth must use YYYY-MM-DD.", 400, "INVALID_BIRTH_DATE");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfBirth)) {
    throw new ResponseError("Time of birth must use HH:MM.", 400, "INVALID_BIRTH_TIME");
  }
  if (!validTimezone(timezone)) {
    throw new ResponseError("Enter a valid IANA birth timezone.", 400, "INVALID_TIMEZONE");
  }

  const approximateBirth = new Date(`${dateOfBirth}T${timeOfBirth}:00Z`);
  if (
    Number.isNaN(approximateBirth.getTime()) ||
    approximateBirth.getTime() > nowMilliseconds + 86_400_000
  ) {
    throw new ResponseError("Birth date cannot be in the future.", 400, "INVALID_BIRTH_DATE");
  }

  return {
    fullName: requiredString(body.fullName, "Full name", 2, 100),
    gender: optionalString(body.gender, 30),
    language: supportedLanguage(body.language),
    notificationTime: notificationTime(body.notificationTime),
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

export function parseProfileUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (body.fullName !== undefined) {
    update.full_name = requiredString(body.fullName, "Full name", 2, 100);
  }
  if (body.gender !== undefined) update.gender = optionalString(body.gender, 30) ?? null;
  if (body.language !== undefined) update.preferred_language = supportedLanguage(body.language);
  if (body.notificationTime !== undefined) {
    update.notification_time = notificationTime(body.notificationTime, "INVALID_PROFILE_UPDATE");
  }
  if (body.notificationsEnabled !== undefined) {
    if (typeof body.notificationsEnabled !== "boolean") {
      throw new ResponseError(
        "Notification preference is not valid.",
        400,
        "INVALID_PROFILE_UPDATE",
      );
    }
    update.notifications_enabled = body.notificationsEnabled;
  }
  if (body.currentCity !== undefined) {
    update.current_city = optionalString(body.currentCity, 120) ?? null;
  }
  return update;
}

export function subscriptionState(row: SubscriptionRow | null, nowMilliseconds = Date.now()) {
  const trialEnd = row?.trial_end_date ? new Date(row.trial_end_date).getTime() : 0;
  const subscriptionEnd = row?.subscription_end_date
    ? new Date(row.subscription_end_date).getTime()
    : 0;
  const trialActive = row?.status === "trial" && trialEnd > nowMilliseconds;
  const paidActive = row?.status === "active" && (!subscriptionEnd || subscriptionEnd > nowMilliseconds);
  const end = trialActive ? trialEnd : paidActive ? subscriptionEnd : 0;
  const inactiveStatus = row?.status === "cancelled" ? "cancelled" : "expired";
  return {
    access: trialActive ? "trial" : paidActive ? "active" : "limited",
    status: trialActive ? "trial" : paidActive ? "active" : inactiveStatus,
    trialEndsAt: row?.trial_end_date ?? undefined,
    subscriptionEndsAt: row?.subscription_end_date ?? undefined,
    daysRemaining: end ? Math.max(0, Math.ceil((end - nowMilliseconds) / 86_400_000)) : 0,
    isPremium: trialActive || paidActive,
  };
}
