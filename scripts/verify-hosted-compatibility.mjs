#!/usr/bin/env node

import process from "node:process";
import { createInterface } from "node:readline/promises";

const DEFAULT_API_URL = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api";
const SUBJECT_PROFILE = Object.freeze({
  fullName: "Horos Compatibility Test",
  gender: "Prefer not to say",
  language: "English",
  notificationTime: "08:00",
  dateOfBirth: "1998-10-26",
  timeOfBirth: "10:28",
  birthPlace: "Nagarjuna Sagar, Telangana, India",
  currentCity: "Hyderabad",
  timezone: "Asia/Kolkata",
  latitude: 16.575,
  longitude: 79.312,
  altitudeMeters: 120,
});
const PARTNER_BIRTH = Object.freeze({
  dateOfBirth: "1999-04-15",
  timeOfBirth: "14:35",
  timezone: "Asia/Kolkata",
  latitude: 17.385,
  longitude: 78.4867,
  altitudeMeters: 542,
});
const COMPONENT_MAXIMUMS = Object.freeze({
  varna: 1,
  vashya: 2,
  tara: 3,
  yoni: 4,
  graha_maitri: 5,
  gana: 6,
  bhakoot: 7,
  nadi: 8,
});
const RAW_BIRTH_KEYS = new Set([
  "birth",
  "subject_birth",
  "partner_birth",
  "date_of_birth",
  "dateOfBirth",
  "time_of_birth",
  "timeOfBirth",
  "local_datetime",
  "localDateTime",
  "timezone",
  "latitude",
  "longitude",
  "altitude_meters",
  "altitudeMeters",
]);

function usage() {
  console.log(`Usage:
  npm run verify:hosted-compatibility -- --identifier <email-or-phone> --confirm-disposable [options]

Options:
  --api-url <url>           Override the hosted Horos API URL.
  --identifier <value>      Disposable email or E.164 phone number.
  --confirm-disposable      Required; allows creation and deletion of the test account.
  --help                    Show this help.

The script never prints OTPs, access tokens or refresh tokens.`);
}

function parseArguments(argv) {
  const result = {
    apiUrl: DEFAULT_API_URL,
    identifier: "",
    confirmDisposable: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      usage();
      process.exit(0);
    }
    if (argument === "--confirm-disposable") {
      result.confirmDisposable = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === "--api-url") result.apiUrl = value;
    else if (argument === "--identifier") result.identifier = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  return result;
}

function normalizedApiUrl(value) {
  const parsed = new URL(value.trim().replace(/\/$/, ""));
  if (parsed.protocol !== "https:") {
    throw new Error("The hosted compatibility verifier requires an HTTPS API URL.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(message) {
  console.log(`PASS  ${message}`);
}

function note(message) {
  console.log(`INFO  ${message}`);
}

function bodyCode(response) {
  return response.body && typeof response.body === "object" ? response.body.code : undefined;
}

async function apiRequest(apiUrl, path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed };
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    const code = bodyCode(response);
    throw new Error(`${label} returned HTTP ${response.status}${code ? ` (${code})` : ""}; expected ${expected}.`);
  }
}

async function askText(question) {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive terminal input is required. Pass --identifier and run from a terminal.");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

async function askMasked(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("OTP entry requires an interactive terminal.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    const stdin = process.stdin;
    const stdout = process.stdout;
    const wasRaw = stdin.isRaw;
    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    }
    function finish() {
      cleanup();
      stdout.write("\n");
      resolve(value);
    }
    function onData(chunk) {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Verification cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\b" || character === "\u007f") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (/\d/.test(character) && value.length < 6) {
          value += character;
          stdout.write("*");
        }
      }
    }
    stdout.write(question);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function authenticate(apiUrl, identifier) {
  const request = await apiRequest(apiUrl, "/auth/login", {
    method: "POST",
    body: { identifier },
  });
  assertStatus(request, 200, "OTP request");
  assert(request.body?.requiresOtp === true, "OTP request did not return requiresOtp=true.");
  pass("OTP request accepted");
  const otp = (await askMasked("Six-digit OTP: ")).trim();
  assert(/^\d{6}$/.test(otp), "OTP must contain exactly six digits.");
  const verification = await apiRequest(apiUrl, "/auth/login", {
    method: "POST",
    body: { identifier, otp },
  });
  assertStatus(verification, 200, "OTP verification");
  assert(typeof verification.body?.token === "string" && verification.body.token.length > 20,
    "OTP verification returned no access token.");
  pass("OTP verification returned a valid session");
  return verification.body.token;
}

function collectRawBirthKeys(value, path = "$", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRawBirthKeys(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== "object") return findings;
  for (const [key, item] of Object.entries(value)) {
    if (RAW_BIRTH_KEYS.has(key)) findings.push(`${path}.${key}`);
    collectRawBirthKeys(item, `${path}.${key}`, findings);
  }
  return findings;
}

function assertProviderEnvelope(report, label) {
  assert(report?.calculationMode === "provider", `${label} did not use provider mode.`);
  assert(typeof report?.provider?.requestId === "string" && report.provider.requestId.startsWith("horos-"),
    `${label} did not return a Horos request ID.`);
  const leakedKeys = collectRawBirthKeys(report);
  assert(leakedKeys.length === 0, `${label} leaked raw birth keys: ${leakedKeys.join(", ")}.`);
}

function assertReport(report, expectedMaximum, expectedComplete) {
  assertProviderEnvelope(report, `${expectedMaximum}/36 compatibility report`);
  const facts = report?.facts;
  const interpretation = report?.interpretation;
  assert(facts?.facts_version === "compatibility_facts_v2", "Facts version is not compatibility_facts_v2.");
  assert(facts?.compatibility_profile === "ashtakoota_v2", "Compatibility profile is not ashtakoota_v2.");
  assert(Array.isArray(facts?.ashtakoota_components) && facts.ashtakoota_components.length === 8,
    "Compatibility facts did not contain eight Ashtakoota components.");
  const seen = new Set();
  let evaluatedMaximum = 0;
  let achievedTotal = 0;
  for (const component of facts.ashtakoota_components) {
    const expectedComponentMaximum = COMPONENT_MAXIMUMS[component.component];
    assert(expectedComponentMaximum !== undefined && !seen.has(component.component),
      "Compatibility facts contain an unknown or duplicate component.");
    seen.add(component.component);
    assert(component.maximum_points === expectedComponentMaximum,
      `${component.component} maximum points are inconsistent.`);
    if (component.status === "evaluated") {
      assert(typeof component.achieved_points === "number" && component.achieved_points >= 0 &&
        component.achieved_points <= expectedComponentMaximum,
      `${component.component} evaluated points are invalid.`);
      assert(component.abstention_reason === null, `${component.component} evaluated result has an abstention reason.`);
      evaluatedMaximum += expectedComponentMaximum;
      achievedTotal += component.achieved_points;
    } else {
      assert(component.status === "abstained", `${component.component} has an unsupported status.`);
      assert(component.achieved_points === null && typeof component.abstention_reason === "string",
        `${component.component} abstention is invalid.`);
    }
  }
  assert(evaluatedMaximum === expectedMaximum, `Component coverage was ${evaluatedMaximum}/36; expected ${expectedMaximum}/36.`);
  assert(facts.evaluated_maximum_points === expectedMaximum, "Facts evaluated maximum is inconsistent.");
  assert(facts.total_maximum_points === 36, "Facts total maximum is not 36.");
  assert(facts.complete_36_point_evaluation === expectedComplete, "Facts completeness flag is inconsistent.");
  assert(Math.abs(facts.total_achieved_points - achievedTotal) < 1e-6,
    "Facts total achieved points do not equal the component sum.");
  assert(Array.isArray(facts.subject_manglik_factors) && facts.subject_manglik_factors.length === 3,
    "Subject Manglik facts are incomplete.");
  assert(Array.isArray(facts.partner_manglik_factors) && facts.partner_manglik_factors.length === 3,
    "Partner Manglik facts are incomplete.");

  assert(interpretation?.interpretation_version === "compatibility_interpretation_v1",
    "Interpretation version is not compatibility_interpretation_v1.");
  assert(interpretation.evaluated_maximum_points === expectedMaximum,
    "Interpretation evaluated maximum is inconsistent.");
  assert(interpretation.complete_36_point_evaluation === expectedComplete,
    "Interpretation completeness flag is inconsistent.");
  assert(Array.isArray(interpretation.components) && interpretation.components.length === 8,
    "Interpretation did not contain eight components.");
  const index = interpretation.partnership_index;
  assert(index?.domain === "partnership" && index.score_version === "outlook_index_v1",
    "Partnership outlook index contract is invalid.");
  assert(Math.abs(index.coverage - expectedMaximum / 36) < 1e-6,
    "Partnership outlook coverage is inconsistent.");
  const expectedConfidence = expectedComplete ? "uncalibrated_moderate" : "uncalibrated_low";
  assert(index.confidence_status === expectedConfidence,
    `Partnership confidence was ${index.confidence_status}; expected ${expectedConfidence}.`);
  pass(`${expectedMaximum}/36 report contract and interpretation coverage passed`);
}

async function createProfile(apiUrl, token) {
  const response = await apiRequest(apiUrl, "/profile/create", {
    method: "POST",
    token,
    body: SUBJECT_PROFILE,
  });
  assertStatus(response, 201, "Profile creation");
  assert(response.body?.subscription?.isPremium === true,
    "The disposable trial did not grant premium compatibility access.");
  pass("Disposable profile received premium trial access");
}

async function readProfile(apiUrl, token) {
  const response = await apiRequest(apiUrl, "/profile/me", { token });
  assertStatus(response, 200, "Profile read");
  return response.body?.profile;
}

async function requestReport(apiUrl, token, subjectRole, partnerRole) {
  const response = await apiRequest(apiUrl, "/compatibility/report", {
    method: "POST",
    token,
    body: {
      partnerBirth: PARTNER_BIRTH,
      subjectRole,
      partnerRole,
    },
  });
  assertStatus(response, 200, `${subjectRole}/${partnerRole} compatibility report`);
  return response.body;
}

async function deleteAccount(apiUrl, token) {
  const response = await apiRequest(apiUrl, "/profile/me", { method: "DELETE", token });
  assertStatus(response, 200, "Disposable account deletion");
  assert(response.body?.deleted === true, "Disposable account deletion did not confirm deletion.");
  const after = await apiRequest(apiUrl, "/profile/me", { token });
  assertStatus(after, 401, "Deleted-session verification");
  pass("Disposable account was deleted and its session invalidated");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assert(options.confirmDisposable,
    "--confirm-disposable is required because this verifier creates and deletes a test account.");
  const apiUrl = normalizedApiUrl(options.apiUrl);
  const identifier = (options.identifier || await askText("Disposable email or E.164 phone: ")).trim();
  assert(identifier.length >= 5, "A disposable identifier is required.");

  console.log("Horos hosted compatibility acceptance verifier");
  note(`API: ${apiUrl}`);
  note("OTPs and tokens are never printed.");

  const health = await apiRequest(apiUrl, "/health");
  assertStatus(health, 200, "Health check");
  assert(health.body?.status === "ok" && health.body?.astroProviderConfigured === true,
    "Hosted Horos or Astro provider is not healthy.");
  assert(health.body?.phase4CompatibilityEnabled === true,
    "Compatibility is not enabled on the hosted backend.");
  pass("Hosted compatibility flag is enabled for acceptance");

  const unauthenticated = await apiRequest(apiUrl, "/compatibility/report", {
    method: "POST",
    body: {},
  });
  assertStatus(unauthenticated, 401, "Unauthenticated compatibility boundary");
  pass("Compatibility report rejects unauthenticated requests");

  let token = null;
  let cleanupRequired = false;
  try {
    token = await authenticate(apiUrl, identifier);
    cleanupRequired = true;
    await createProfile(apiUrl, token);
    const beforeProfile = await readProfile(apiUrl, token);

    const partial = await requestReport(apiUrl, token, "unspecified", "unspecified");
    assertReport(partial, 27, false);

    const complete = await requestReport(apiUrl, token, "groom", "bride");
    assertReport(complete, 36, true);
    assert(partial.facts.subject_fingerprint === complete.facts.subject_fingerprint,
      "Subject fingerprint changed between role-neutral and role-aware reports.");
    assert(partial.facts.partner_fingerprint === complete.facts.partner_fingerprint,
      "Partner fingerprint changed between role-neutral and role-aware reports.");
    pass("Role-neutral and role-aware reports use the same anonymous chart identities");

    const afterProfile = await readProfile(apiUrl, token);
    assert(JSON.stringify(beforeProfile) === JSON.stringify(afterProfile),
      "Stored user profile changed after compatibility report requests.");
    pass("Compatibility requests did not mutate the stored user profile");

    await deleteAccount(apiUrl, token);
    cleanupRequired = false;
    console.log("PASS  Horos hosted compatibility acceptance completed.");
  } finally {
    if (cleanupRequired && token) {
      note("Attempting disposable-account cleanup after an incomplete acceptance run.");
      try {
        await deleteAccount(apiUrl, token);
      } catch (error) {
        console.error(`WARN  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
