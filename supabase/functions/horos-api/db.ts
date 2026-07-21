import { createClient, type User } from "supabase";

import type { BirthDetailsRow, Period, ProfileRow, SubscriptionRow } from "./types.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

const supabaseUrl = requiredEnv("SUPABASE_URL");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

export async function requireUser(request: Request): Promise<User> {
  const token = bearerToken(request);
  if (!token) throw new ResponseError("Please sign in again.", 401, "UNAUTHORIZED");
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new ResponseError("Please sign in again.", 401, "UNAUTHORIZED");
  }
  return data.user;
}

export class ResponseError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "ResponseError";
  }
}

export function normalizeIdentifier(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return trimmed.replace(/[\s()-]/g, "");
}

export function userIdentifier(user: User): string {
  return normalizeIdentifier(user.email ?? user.phone ?? user.id);
}

export async function identifierHash(identifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(`horos-trial-v1:${normalizeIdentifier(identifier)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clock(value: string): string {
  return value.slice(0, 5);
}

export async function getProfileRows(userId: string): Promise<{
  profile: ProfileRow;
  birth: BirthDetailsRow;
} | null> {
  const [profileResult, birthResult] = await Promise.all([
    adminClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    adminClient.from("birth_details").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (birthResult.error) throw birthResult.error;
  if (!profileResult.data || !birthResult.data) return null;
  return {
    profile: profileResult.data as ProfileRow,
    birth: birthResult.data as BirthDetailsRow,
  };
}

export function profileJson(
  user: User,
  rows: { profile: ProfileRow; birth: BirthDetailsRow },
) {
  return {
    id: user.id,
    fullName: rows.profile.full_name,
    identifier: userIdentifier(user),
    gender: rows.profile.gender ?? undefined,
    language: rows.profile.preferred_language,
    notificationTime: clock(rows.profile.notification_time),
    notificationsEnabled: rows.profile.notifications_enabled,
    birth: {
      dateOfBirth: rows.birth.date_of_birth,
      timeOfBirth: clock(rows.birth.time_of_birth),
      birthPlace: rows.birth.birth_place,
      currentCity: rows.profile.current_city ?? undefined,
      timezone: rows.birth.timezone,
      latitude: rows.birth.latitude,
      longitude: rows.birth.longitude,
      altitudeMeters: rows.birth.altitude_meters,
    },
    rashi: rows.birth.rashi,
    nakshatra: rows.birth.nakshatra,
    lagna: rows.birth.lagna,
    calculationProfile: rows.birth.calculation_profile,
    calculationMode: rows.birth.calculation_mode,
  };
}

export function subscriptionState(row: SubscriptionRow | null) {
  const now = Date.now();
  const trialEnd = row?.trial_end_date ? new Date(row.trial_end_date).getTime() : 0;
  const subscriptionEnd = row?.subscription_end_date
    ? new Date(row.subscription_end_date).getTime()
    : 0;
  const trialActive = row?.status === "trial" && trialEnd > now;
  const paidActive = row?.status === "active" && (!subscriptionEnd || subscriptionEnd > now);
  const end = trialActive ? trialEnd : paidActive ? subscriptionEnd : 0;
  return {
    access: trialActive ? "trial" : paidActive ? "active" : "limited",
    status: trialActive ? "trial" : paidActive ? "active" : row?.status ?? "expired",
    trialEndsAt: row?.trial_end_date ?? undefined,
    subscriptionEndsAt: row?.subscription_end_date ?? undefined,
    daysRemaining: end ? Math.max(0, Math.ceil((end - now) / 86_400_000)) : 0,
    isPremium: trialActive || paidActive,
  };
}

export async function getSubscription(userId: string) {
  const result = await adminClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  const row = (result.data as SubscriptionRow | null) ?? null;
  const state = subscriptionState(row);
  if (row && !state.isPremium && (row.status === "trial" || row.status === "active")) {
    const update = await adminClient
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", userId);
    if (update.error) throw update.error;
  }
  return state;
}

export function localDateInTimezone(timezone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function periodKey(period: Period, date = new Date()): string {
  if (period === "daily") return date.toISOString().slice(0, 10);
  if (period === "monthly") return date.toISOString().slice(0, 7);
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - firstDay.getTime()) / 86_400_000 + firstDay.getUTCDay() + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function cacheExpiry(period: Period, date = new Date()): string {
  if (period === "daily") {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
    ).toISOString();
  }
  if (period === "weekly") return new Date(date.getTime() + 7 * 86_400_000).toISOString();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
}
