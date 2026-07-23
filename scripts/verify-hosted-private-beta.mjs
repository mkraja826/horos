#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const DEFAULT_API_URL = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api";
const DEFAULT_PROFILE = Object.freeze({
  fullName: "Horos Private Beta Test",
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

function usage() {
  console.log(`Usage:
  npm run verify:hosted-beta -- --identifier <email-or-phone> [options]

Options:
  --api-url <url>                         Override the hosted Horos API URL.
  --identifier <value>                    Disposable email or E.164 phone number.
  --confirm-disposable                    Allow account deletion and repeat-trial check.
  --skip-repeat-trial-check               Delete once without recreating the identifier.
  --revenuecat-webhook-secret-file <path> Send an authorized TEST webhook using a local secret file.
  --help                                  Show this help.

The script never prints OTPs, access tokens, refresh tokens, or webhook secrets.`);
}

function parseArguments(argv) {
  const result = {
    apiUrl: DEFAULT_API_URL,
    identifier: "",
    confirmDisposable: false,
    skipRepeatTrialCheck: false,
    revenueCatWebhookSecretFile: "",
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
    if (argument === "--skip-repeat-trial-check") {
      result.skipRepeatTrialCheck = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === "--api-url") result.apiUrl = value;
    else if (argument === "--identifier") result.identifier = value;
    else if (argument === "--revenuecat-webhook-secret-file") {
      result.revenueCatWebhookSecretFile = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
    index += 1;
  }
  return result;
}

function normalizedApiUrl(value) {
  const parsed = new URL(value.trim().replace(/\/$/, ""));
  if (parsed.protocol !== "https:") {
    throw new Error("The hosted private-beta verifier requires an HTTPS API URL.");
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

async function apiRequest(apiUrl, path, { method = "GET", token, body, headers = {} } = {}) {
  const requestHeaders = { Accept: "application/json", ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: requestHeaders,
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
  return { status: response.status, body: parsed, headers: response.headers };
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    const code = bodyCode(response);
    throw new Error(`${label} returned HTTP ${response.status}${code ? ` (${code})` : ""}; expected ${expected}.`);
  }
}

async function askText(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

async function askMasked(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return askText(question);
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

async function authenticate(apiUrl, identifier, attemptLabel) {
  const request = await apiRequest(apiUrl, "/auth/login", {
    method: "POST",
    body: { identifier },
  });
  assertStatus(request, 200, `${attemptLabel} OTP request`);
  assert(request.body?.requiresOtp === true, `${attemptLabel} OTP request did not return requiresOtp=true.`);
  pass(`${attemptLabel} OTP request accepted`);

  const otp = (await askMasked(`${attemptLabel} six-digit OTP: `)).trim();
  assert(/^\d{6}$/.test(otp), "OTP must contain exactly six digits.");

  const verification = await apiRequest(apiUrl, "/auth/login", {
    method: "POST",
    body: { identifier, otp },
  });
  assertStatus(verification, 200, `${attemptLabel} OTP verification`);
  assert(typeof verification.body?.token === "string" && verification.body.token.length > 20,
    `${attemptLabel} OTP verification returned no access token.`);
  assert(typeof verification.body?.refreshToken === "string" && verification.body.refreshToken.length > 20,
    `${attemptLabel} OTP verification returned no refresh token.`);
  pass(`${attemptLabel} OTP verification returned a valid session`);
  return {
    token: verification.body.token,
    refreshToken: verification.body.refreshToken,
  };
}

function assertProviderResult(response, label) {
  assertStatus(response, 200, label);
  assert(response.body?.calculationMode === "provider", `${label} did not use provider mode.`);
  const requestId = response.body?.provider?.requestId;
  assert(typeof requestId === "string" && requestId.startsWith("horos-"),
    `${label} did not return a Horos request ID.`);
  pass(`${label} returned provider mode with a Horos request ID`);
}

async function createProfileAndVerifyTrial(apiUrl, token, expectTrial) {
  const response = await apiRequest(apiUrl, "/profile/create", {
    method: "POST",
    token,
    body: DEFAULT_PROFILE,
  });
  assertStatus(response, 201, "Profile creation");
  const profile = response.body?.profile;
  assert(profile?.birth?.dateOfBirth === DEFAULT_PROFILE.dateOfBirth, "Persisted birth date differs from the submitted value.");
  assert(profile?.birth?.timeOfBirth === DEFAULT_PROFILE.timeOfBirth, "Persisted birth time differs from the submitted value.");
  assert(profile?.birth?.timezone === DEFAULT_PROFILE.timezone, "Persisted timezone differs from the submitted value.");
  assert(Number(profile?.birth?.latitude) === DEFAULT_PROFILE.latitude, "Persisted latitude differs from the submitted value.");
  assert(Number(profile?.birth?.longitude) === DEFAULT_PROFILE.longitude, "Persisted longitude differs from the submitted value.");
  pass("Profile creation persisted the exact test birth data");

  const subscription = response.body?.subscription;
  if (expectTrial) {
    assert(subscription?.access === "trial" && subscription?.status === "trial",
      "The first disposable-user profile did not receive the trial.");
    pass("First sign-up received one active trial");
  } else {
    assert(subscription?.access !== "trial" && subscription?.status !== "trial",
      "The repeated identifier incorrectly received a second trial.");
    pass("Repeated sign-up did not receive a second trial");
  }

  return { profile, subscription };
}

async function verifyAuthenticatedFlow(apiUrl, session) {
  const profileRead = await apiRequest(apiUrl, "/profile/me", { token: session.token });
  assertStatus(profileRead, 200, "Profile read");
  pass("Authenticated profile read succeeded");

  const subscription = await apiRequest(apiUrl, "/subscription/status", { token: session.token });
  assertStatus(subscription, 200, "Subscription status");
  assert(subscription.body?.isPremium === true, "The active trial did not grant premium access.");
  pass("Trial grants premium-route access");

  assertProviderResult(
    await apiRequest(apiUrl, "/birth-chart", { token: session.token }),
    "Birth chart",
  );
  assertProviderResult(
    await apiRequest(apiUrl, "/panchang/today", { token: session.token }),
    "Panchang",
  );

  for (const period of ["daily", "weekly", "monthly"]) {
    assertProviderResult(
      await apiRequest(apiUrl, `/horoscope/${period}`, { token: session.token }),
      `${period[0].toUpperCase()}${period.slice(1)} v2 reading`,
    );
  }

  const refresh = await apiRequest(apiUrl, "/auth/refresh", {
    method: "POST",
    body: { refreshToken: session.refreshToken },
  });
  assertStatus(refresh, 200, "Session refresh");
  assert(typeof refresh.body?.token === "string" && refresh.body.token.length > 20,
    "Session refresh returned no access token.");
  assert(typeof refresh.body?.refreshToken === "string" && refresh.body.refreshToken.length > 20,
    "Session refresh returned no refresh token.");
  pass("Session refresh returned a valid replacement session");
  return { token: refresh.body.token, refreshToken: refresh.body.refreshToken };
}

async function verifyWebhookBoundary(apiUrl) {
  const event = {
    event: {
      id: `unauthorized-${randomUUID()}`,
      event_timestamp_ms: Date.now(),
      type: "TEST",
    },
  };
  const response = await apiRequest(apiUrl, "/subscription/webhook", {
    method: "POST",
    body: event,
  });
  assertStatus(response, 401, "Unauthorized RevenueCat webhook probe");
  pass("RevenueCat webhook rejects missing authorization with HTTP 401");
}

async function verifyAuthorizedWebhook(apiUrl, secretFile, userId) {
  if (!secretFile) {
    note("Authorized RevenueCat TEST webhook skipped; no local secret file was provided.");
    return null;
  }
  const secret = (await readFile(secretFile, "utf8")).trim();
  assert(secret.length >= 16, "RevenueCat webhook secret file is empty or invalid.");
  const eventId = `horos-acceptance-${randomUUID()}`;
  const payload = {
    event: {
      id: eventId,
      event_timestamp_ms: Date.now(),
      type: "TEST",
      app_user_id: userId,
    },
  };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await apiRequest(apiUrl, "/subscription/webhook", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: payload,
    });
    assertStatus(response, 200, `Authorized RevenueCat TEST webhook attempt ${attempt}`);
  }
  pass(`Authorized RevenueCat TEST webhook accepted idempotently (${eventId})`);
  return eventId;
}

async function deleteAndVerify(apiUrl, token, label) {
  const deletion = await apiRequest(apiUrl, "/profile/me", { method: "DELETE", token });
  assertStatus(deletion, 200, `${label} account deletion`);
  assert(deletion.body?.deleted === true, `${label} account deletion did not confirm deletion.`);

  const after = await apiRequest(apiUrl, "/profile/me", { token });
  assertStatus(after, 401, `${label} deleted-token check`);
  pass(`${label} account deletion invalidated the prior session`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const apiUrl = normalizedApiUrl(options.apiUrl);
  const identifier = (options.identifier || await askText("Disposable email or E.164 phone: ")).trim();
  assert(identifier.length >= 5, "A disposable identifier is required.");

  console.log("Horos hosted private-beta acceptance verifier");
  note(`API: ${apiUrl}`);
  note("Tokens, OTPs and secrets are never printed.");

  const health = await apiRequest(apiUrl, "/health");
  assertStatus(health, 200, "Health check");
  assert(health.body?.status === "ok", "Health response did not report status=ok.");
  assert(health.body?.astroProviderConfigured === true, "Health response reports that Astro is not configured.");
  pass("Hosted function and Astro provider configuration are healthy");

  const unauthenticatedProfile = await apiRequest(apiUrl, "/profile/me");
  assertStatus(unauthenticatedProfile, 401, "Protected-route boundary");
  pass("Protected routes reject unauthenticated requests");

  await verifyWebhookBoundary(apiUrl);

  let firstSession = await authenticate(apiUrl, identifier, "Initial");
  const firstCreation = await createProfileAndVerifyTrial(apiUrl, firstSession.token, true);
  firstSession = await verifyAuthenticatedFlow(apiUrl, firstSession);
  await verifyAuthorizedWebhook(
    apiUrl,
    options.revenueCatWebhookSecretFile,
    firstCreation.profile.id,
  );

  if (!options.confirmDisposable) {
    note("Destructive acceptance steps skipped. Re-run with --confirm-disposable for deletion and repeat-trial verification.");
    console.log("PARTIAL PASS  Hosted core flow passed; full acceptance remains open.");
    return;
  }

  await deleteAndVerify(apiUrl, firstSession.token, "Initial disposable");

  if (options.skipRepeatTrialCheck) {
    note("Repeat-trial check skipped by request.");
    console.log("PARTIAL PASS  Account deletion passed; repeat-trial acceptance remains open.");
    return;
  }

  const repeatedSession = await authenticate(apiUrl, identifier, "Repeat sign-up");
  await createProfileAndVerifyTrial(apiUrl, repeatedSession.token, false);
  const repeatedSubscription = await apiRequest(apiUrl, "/subscription/status", {
    token: repeatedSession.token,
  });
  assertStatus(repeatedSubscription, 200, "Repeated subscription status");
  assert(repeatedSubscription.body?.isPremium === false,
    "The repeated identifier retained premium access without an active purchase.");
  pass("Repeated identifier remains limited without a second trial");
  await deleteAndVerify(apiUrl, repeatedSession.token, "Repeated disposable");

  console.log("PASS  Horos hosted v12 private-beta acceptance flow completed.");
}

main().catch((error) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
