import { authClient, getProfileRows, normalizeIdentifier, profileJson, ResponseError } from "./db.ts";

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

export async function requestOtp(body: Record<string, unknown>) {
  const identifier = validateIdentifier(body.identifier);
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
    throw new ResponseError(
      result.error.message || "The verification code could not be sent.",
      502,
      "OTP_DELIVERY_FAILED",
    );
  }
  return { requiresOtp: true as const, challengeId: crypto.randomUUID() };
}

export async function verifyOtp(body: Record<string, unknown>) {
  const identifier = validateIdentifier(body.identifier);
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    throw new ResponseError("Enter the six-digit verification code.", 400, "OTP_INCORRECT");
  }

  const result = isEmail(identifier)
    ? await authClient.auth.verifyOtp({ email: identifier, token: otp, type: "email" })
    : await authClient.auth.verifyOtp({ phone: identifier, token: otp, type: "sms" });
  if (result.error || !result.data.session || !result.data.user) {
    throw new ResponseError(
      result.error?.message || "That code is invalid or expired.",
      400,
      "OTP_INCORRECT",
    );
  }

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
