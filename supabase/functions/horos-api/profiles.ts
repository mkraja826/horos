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
import { buildProfileWriteArguments } from "./profile_write.ts";
import { parseProfileInput, parseProfileUpdate } from "./user_flow.ts";

export async function createProfile(user: User, body: Record<string, unknown>) {
  const input = parseProfileInput(body);
  const chart = await calculateChart(input, user.id);
  const hash = await identifierHash(userIdentifier(user));
  const write = await adminClient.rpc(
    "write_horos_profile_v1",
    buildProfileWriteArguments(user.id, hash, input, chart),
  );
  if (write.error) throw write.error;

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
