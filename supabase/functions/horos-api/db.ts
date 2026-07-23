import { createClient, type User } from "supabase";

import { ResponseError } from "./errors.ts";
import type { BirthDetailsRow, ProfileRow, SubscriptionRow } from "./types.ts";
import { subscriptionState } from "./user_flow.ts";

export { ResponseError } from "./errors.ts";
export { cacheExpiry, localDateInTimezone, periodKey } from "./periods.ts";
export { subscriptionState } from "./user_flow.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function preferredNamedKey(namedEnv: string, legacyEnv: string): string {
  const raw = Deno.env.get(namedEnv)?.trim();
  if (!raw) return requiredEnv(legacyEnv);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${namedEnv} is not valid JSON.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${namedEnv} is not a named-key object.`);
  }

  const value = (parsed as Record<string, unknown>).default;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${namedEnv}.default is not configured.`);
  }
  return value.trim();
}

const supabaseUrl = requiredEnv("SUPABASE_URL");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const adminKey = preferredNamedKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

export const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const adminClient = createClient(supabaseUrl, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
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

export async function getSubscription(userId: string) {
  const result = await adminClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  const row = (result.data as SubscriptionRow | null) ?? null;
  const state = subscriptionState(row);
  if (
    row &&
    !state.isPremium &&
    (row.status === "trial" || row.status === "active" || row.status === "cancelled")
  ) {
    const update = await adminClient
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", userId);
    if (update.error) throw update.error;
  }
  return state;
}
