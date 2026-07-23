#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const EXPECTED_API_URL = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api";
const EXTERNAL_PUBLIC_VARIABLES = [
  "EXPO_PUBLIC_EAS_PROJECT_ID",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await readFile(new URL("../eas.json", import.meta.url), "utf8");
const eas = JSON.parse(source);
const profile = eas.build?.["private-beta"];

assert(profile && typeof profile === "object", "The private-beta EAS profile is missing.");
assert(profile.extends === "base", "The private-beta profile must extend the pinned base toolchain.");
assert(profile.environment === "production", "The private-beta profile must use the EAS production environment.");
assert(profile.distribution === "internal", "The private-beta profile must use internal distribution.");
assert(profile.android?.buildType === "apk", "The private-beta Android artifact must be an installable APK.");
assert(profile.env?.EXPO_PUBLIC_API_URL === EXPECTED_API_URL,
  "The private-beta API URL is not bound to the hosted Horos Edge Function.");
assert(profile.env?.EXPO_PUBLIC_APP_ENV === "production",
  "The private-beta application environment must be production.");
assert(String(profile.env?.EXPO_PUBLIC_ALLOW_DEMO_DATA) === "false",
  "The private-beta profile must disable demo data.");

for (const name of EXTERNAL_PUBLIC_VARIABLES) {
  assert(!(name in (profile.env ?? {})),
    `${name} must remain an external EAS project variable and must not be committed in the build profile.`);
}

console.log("Private-beta EAS profile: PASS");
console.log("Hosted API: pinned");
console.log("Demo data: disabled");
console.log("Android artifact: internal APK");
console.log("EAS and RevenueCat public identifiers: external");
