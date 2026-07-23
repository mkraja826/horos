import {
  adminClient,
  authClient,
  getProfileRows,
  normalizeIdentifier,
  profileJson,
  ResponseError,
} from "./db.ts";
import { authRateScopeHashes, parseAuthRateLimitResult } from "./auth_rate.ts";

function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}

function validateIdentifier(value: unknown): string {
  if (typeof value !== "string") {
    throw new ResponseError("Enter a valid phone number or email address.", 400, "INVALID_LOGIN");
  }
  const identifier = normalizeIdentifier(value);
  if (identifier.length < 5 || identifier.length > 160) {
    throw new ResponseError("Enter a valid phone number or email address.", 400, "INVALID_LOGIN");
  }
  if (isEmail(identifier) && !/^\S+@\S+\.\S+$/.test(identifier)) {
    throw new ResponseError("Enter a valid email address.", 400, "INVALID_LOGIN");
  }
  if (!isEmail(identifier) && !/^\+[1-9]\d{7,14}$/.test(identifier)) {
    throw new ResponseError(
      "Enter the phone number with country code, for example +919876543210.",
      400,
      "INVALID_LOGIN",
    );
  }
  return identifier;
}

async function enforceAuthRateLimit(
  request: Request,
  identifier: string,
  action: "request" | "verify",
) {
  const hashes = await authRateScopeHashes(request, identifier);
  const result = await adminClient.rpc("consume_horos_auth_limits_v1", {
    p_identifier_hash: hashes.identifierHash,
    p_ip_hash: hashes.ipHash,
    p_action: action,
  });
  if (result.error) {
    console.error("Auth rate-limit check failed", result.error);
    throw new ResponseError(
      "Sign-in protection is temporarily unavailable. Please try again.",
      503,
      "AUTH_RATE_LIMIT_UNAVAILABLE",
    );
  }

  let state;
  try {
    state = parseAuthRateLimitResult(result.data);
  } catch (error) {
    console.error("Auth rate-limit response was invalid", error);
    throw new ResponseError(
      "Sign-in protection is temporarily unavailable. Please try again.",
      503,
      "AUTH_RATE_LIMIT_UNAVAILABLE",
    );
  }

  if (!state.allowed) {
    const retryAfterSeconds = Math.max(1, state.retryAfterSeconds);
    throw new ResponseError(
      "Too many verification attempts. Please try again later.",
      429,
      "AUTH_RATE_LIMITED",
      {
        retryAfterSeconds,
        blockedBy: state.blockedBy,
      },
      { "Retry-After": String(retryAfterSeconds) },
    );
  }

  return hashes;
}

export async function requestOtp(request: Request, body: Record<string, unknown>) {
  const identifier = validateIdentifier(body.identifier);
  await enforceAuthRateLimit(request, identifier, "request");

  const result = isEmail(identifier)
    ? await authClient.auth.signInWithOtp({
        email: identifier,
        options: { shouldCreateUser: true },
      })
    : await authClient.auth.signInWithOtp({
        phone: identifier,
        options: { shouldCreateUser: true },
      });

  if (result.error) {
    console.error("OTP delivery failed", result.error);
    throw new ResponseError(
      "The verification code could not be sent. Please try again later.",
      502,
      "OTP_DELIVERY_FAILED",
    );
  }
  return { requiresOtp: true as const, challengeId: crypto.randomUUID() };
}

export async function verifyOtp(request: Request, body: Record<string, unknown>) {
  const identifier = validateIdentifier(body.identifier);
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    throw new ResponseError("Enter the six-digit verification code.", 400, "OTP_INCORRECT");
  }

  const hashes = await enforceAuthRateLimit(request, identifier, "verify");
  const result = isEmail(identifier)
    ? await authClient.auth.verifyOtp({ email: identifier, token: otp, type: "email" })
    : await authClient.auth.verifyOtp({ phone: identifier, token: otp, type: "sms" });
  if (result.error || !result.data.session || !result.data.user) {
    console.error("OTP verification failed", result.error);
    throw new ResponseError(
      "That code is invalid or expired.",
      400,
      "OTP_INCORRECT",
    );
  }

  const reset = await adminClient.rpc("reset_horos_auth_verify_limits_v1", {
    p_identifier_hash: hashes.identifierHash,
    p_ip_hash: hashes.ipHash,
  });
  if (reset.error) console.error("Auth verification limits could not be reset", reset.error);

  const rows = await getProfileRows(result.data.user.id);
  return {
    token: result.data.session.access_token,
    refreshToken: result.data.session.refresh_token,
    expiresAt: result.data.session.expires_at,
    profile: rows ? profileJson(result.data.user, rows) : null,
  };
}

export async function refreshSession(body: Record<string, unknown>) {
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) {
    throw new ResponseError("The session cannot be refreshed.", 400, "INVALID_REFRESH_TOKEN");
  }
  const result = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (result.error || !result.data.session) {
    throw new ResponseError("Please sign in again.", 401, "SESSION_EXPIRED");
  }
  return {
    token: result.data.session.access_token,
    refreshToken: result.data.session.refresh_token,
    expiresAt: result.data.session.expires_at,
  };
}
