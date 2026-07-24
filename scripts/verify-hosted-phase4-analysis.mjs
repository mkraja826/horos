#!/usr/bin/env node

import process from "node:process";
import { createInterface } from "node:readline/promises";

const DEFAULT_API_URL = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api";
const TARGET_YEAR = 2027;
const TARGET_MONTH = 8;
const PROFILE = Object.freeze({
  fullName: "Horos Phase 4 Analysis Test",
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
const RAW_BIRTH_KEYS = new Set([
  "birth", "date_of_birth", "dateOfBirth", "time_of_birth", "timeOfBirth",
  "local_datetime", "localDateTime", "timezone", "latitude", "longitude",
  "altitude_meters", "altitudeMeters",
]);

function usage() {
  console.log(`Usage:
  npm run verify:hosted-phase4-analysis -- --identifier <email-or-phone> --confirm-disposable [options]

Options:
  --api-url <url>           Override the hosted Horos API URL.
  --identifier <value>      Disposable email or E.164 phone number.
  --confirm-disposable      Required; allows creation and deletion of the test account.
  --help                    Show this help.

The script never prints OTPs, access tokens or refresh tokens.`);
}

function parseArguments(argv) {
  const result = { apiUrl: DEFAULT_API_URL, identifier: "", confirmDisposable: false };
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
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    if (argument === "--api-url") result.apiUrl = value;
    else if (argument === "--identifier") result.identifier = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  return result;
}

function normalizedApiUrl(value) {
  const parsed = new URL(value.trim().replace(/\/$/, ""));
  if (parsed.protocol !== "https:") throw new Error("The hosted verifier requires an HTTPS API URL.");
  return parsed.toString().replace(/\/$/, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function pass(message) { console.log(`PASS  ${message}`); }
function note(message) { console.log(`INFO  ${message}`); }
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
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
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
  if (!process.stdin.isTTY) throw new Error("Interactive terminal input is required.");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await readline.question(question)).trim(); }
  finally { readline.close(); }
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
    function finish() { cleanup(); stdout.write("\n"); resolve(value); }
    function onData(chunk) {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup(); stdout.write("\n"); reject(new Error("Verification cancelled.")); return;
        }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\b" || character === "\u007f") {
          if (value.length > 0) { value = value.slice(0, -1); stdout.write("\b \b"); }
          continue;
        }
        if (/\d/.test(character) && value.length < 6) { value += character; stdout.write("*"); }
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
  const request = await apiRequest(apiUrl, "/auth/login", { method: "POST", body: { identifier } });
  assertStatus(request, 200, "OTP request");
  assert(request.body?.requiresOtp === true, "OTP request did not return requiresOtp=true.");
  pass("OTP request accepted");
  const otp = (await askMasked("Six-digit OTP: ")).trim();
  assert(/^\d{6}$/.test(otp), "OTP must contain exactly six digits.");
  const verification = await apiRequest(apiUrl, "/auth/login", {
    method: "POST", body: { identifier, otp },
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

function assertNoBirthLeak(report, label) {
  const findings = collectRawBirthKeys(report);
  assert(findings.length === 0, `${label} leaked raw birth keys: ${findings.join(", ")}.`);
}

function assertLifeProfile(report) {
  assert(report?.facts?.facts_version === "life_profile_facts_v1", "Life Profile facts version is invalid.");
  assert(report?.interpretation?.interpretation_version === "life_profile_interpretation_v1",
    "Life Profile interpretation version is invalid.");
  assert(Array.isArray(report?.interpretation?.sections) && report.interpretation.sections.length === 10,
    "Life Profile did not return ten sections.");
  assertNoBirthLeak(report, "Life Profile");
  pass("Life Profile contract, ten sections and privacy boundary passed");
}

function assertMonth(report) {
  assert(report?.facts?.facts_version === "period_analysis_facts_v1", "Month facts version is invalid.");
  assert(report?.facts?.year === TARGET_YEAR && report?.facts?.month === TARGET_MONTH,
    "Month report target period is invalid.");
  assert(report?.interpretation?.interpretation_version === "period_analysis_interpretation_v1",
    "Month interpretation version is invalid.");
  assert(Array.isArray(report?.interpretation?.indices) && report.interpretation.indices.length === 7,
    "Month report did not return seven indices.");
  assert(Array.isArray(report?.interpretation?.sections) && report.interpretation.sections.length === 7,
    "Month report did not return seven sections.");
  assertNoBirthLeak(report, "Month analysis");
  pass("Selected-month contract, seven indices and privacy boundary passed");
}

function assertYear(report) {
  assert(report?.facts?.facts_version === "period_analysis_facts_v1", "Year facts version is invalid.");
  assert(report?.facts?.year === TARGET_YEAR, "Year report target year is invalid.");
  assert(report?.interpretation?.interpretation_version === "period_analysis_interpretation_v1",
    "Year interpretation version is invalid.");
  assert(Array.isArray(report?.facts?.months) && report.facts.months.length === 12,
    "Year facts did not return twelve months.");
  assert(Array.isArray(report?.interpretation?.months) && report.interpretation.months.length === 12,
    "Year interpretation did not return twelve months.");
  assert(Array.isArray(report?.interpretation?.overview_indices) && report.interpretation.overview_indices.length === 7,
    "Year report did not return seven overview indices.");
  assertNoBirthLeak(report, "Year analysis");
  pass("Selected-year contract, twelve months, seven indices and privacy boundary passed");
}

async function createProfile(apiUrl, token) {
  const response = await apiRequest(apiUrl, "/profile/create", { method: "POST", token, body: PROFILE });
  assertStatus(response, 201, "Profile creation");
  assert(response.body?.subscription?.isPremium === true,
    "The disposable trial did not grant premium analysis access.");
  pass("Disposable profile received premium trial access");
}

async function readProfile(apiUrl, token) {
  const response = await apiRequest(apiUrl, "/profile/me", { token });
  assertStatus(response, 200, "Profile read");
  return response.body?.profile;
}

async function getReport(apiUrl, token, path, label) {
  const response = await apiRequest(apiUrl, path, { token });
  assertStatus(response, 200, label);
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

  console.log("Horos hosted Phase 4 analysis acceptance verifier");
  note(`API: ${apiUrl}`);
  note("OTPs and tokens are never printed.");

  const health = await apiRequest(apiUrl, "/health");
  assertStatus(health, 200, "Health check");
  assert(health.body?.status === "ok" && health.body?.astroProviderConfigured === true,
    "Hosted Horos or Astro provider is not healthy.");
  assert(health.body?.phase4AnalysisEnabled === true,
    "Phase 4 analysis is not enabled on the hosted backend.");
  pass("Hosted Phase 4 analysis flag is enabled for acceptance");

  for (const path of [
    "/analysis/life-profile",
    `/analysis/month?year=${TARGET_YEAR}&month=${TARGET_MONTH}`,
    `/analysis/year?year=${TARGET_YEAR}`,
  ]) {
    const response = await apiRequest(apiUrl, path);
    assertStatus(response, 401, `Unauthenticated boundary ${path}`);
  }
  pass("All three analysis routes reject unauthenticated requests");

  let token = null;
  let cleanupRequired = false;
  try {
    token = await authenticate(apiUrl, identifier);
    cleanupRequired = true;
    await createProfile(apiUrl, token);
    const beforeProfile = await readProfile(apiUrl, token);

    const life = await getReport(apiUrl, token, "/analysis/life-profile", "Life Profile report");
    assertLifeProfile(life);

    const monthPath = `/analysis/month?year=${TARGET_YEAR}&month=${TARGET_MONTH}`;
    const month = await getReport(apiUrl, token, monthPath, "Selected-month report");
    assertMonth(month);
    const monthRepeat = await getReport(apiUrl, token, monthPath, "Repeated selected-month report");
    assert(JSON.stringify(month) === JSON.stringify(monthRepeat),
      "Repeated selected-month request was not deterministic/cache-stable.");
    pass("Repeated selected-month report is deterministic and cache-stable");

    const year = await getReport(apiUrl, token, `/analysis/year?year=${TARGET_YEAR}`, "Selected-year report");
    assertYear(year);

    const afterProfile = await readProfile(apiUrl, token);
    assert(JSON.stringify(beforeProfile) === JSON.stringify(afterProfile),
      "Stored user profile changed after analysis requests.");
    pass("Analysis requests did not mutate the stored user profile");

    await deleteAccount(apiUrl, token);
    cleanupRequired = false;
    console.log("PASS  Horos hosted Phase 4 analysis acceptance completed.");
  } finally {
    if (cleanupRequired && token) {
      note("Attempting disposable-account cleanup after an incomplete acceptance run.");
      try { await deleteAccount(apiUrl, token); }
      catch (error) {
        console.error(`WARN  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
