import type { Context, Next } from "hono";

import type { Bindings, Variables } from "./types";

const encoder = new TextEncoder();

function toBase64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function hashOtp(challengeId: string, otp: string, secret: string) {
  return toBase64Url(await hmac(`${challengeId}:${otp}`, secret));
}

export async function createToken(userId: string, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 })
  );
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${toBase64Url(await hmac(unsigned, secret))}`;
}

export async function verifyToken(token: string, secret: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = await hmac(`${header}.${payload}`, secret);
  const actual = fromBase64Url(signature);
  if (expected.length !== actual.length) return null;
  let mismatch = 0;
  expected.forEach((value, index) => (mismatch |= value ^ actual[index]));
  if (mismatch !== 0) return null;
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub?: string; exp?: number };
  if (!claims.sub || !claims.exp || claims.exp < Date.now() / 1000) return null;
  return claims.sub;
}

export async function requireAuth(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const authorization = c.req.header("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const userId = token ? await verifyToken(token, c.env.JWT_SECRET) : null;
  if (!userId) return c.json({ code: "UNAUTHORIZED", message: "Please sign in again." }, 401);

  const user = await c.env.DB.prepare("SELECT status FROM users WHERE id = ?").bind(userId).first<{ status: string }>();
  if (!user || user.status !== "active") return c.json({ code: "ACCOUNT_UNAVAILABLE", message: "This account is unavailable." }, 401);
  c.set("userId", userId);
  await c.env.DB.prepare("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId).run();
  return next();
}

export function normalizeIdentifier(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return trimmed.replace(/[\s()-]/g, "");
}
