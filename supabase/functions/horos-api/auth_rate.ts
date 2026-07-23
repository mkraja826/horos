export type AuthRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  blockedBy?: string;
};

function normalizeScopeValue(value: string): string {
  return value.trim().toLowerCase();
}

function authRatePepper(explicitPepper?: string): string {
  const value = explicitPepper?.trim() ||
    Deno.env.get("AUTH_RATE_LIMIT_PEPPER")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!value) throw new Error("Auth rate-limit hashing is not configured.");
  return value;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requestNetworkIdentity(request: Request): string {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare.slice(0, 128);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 128);

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);

  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 160) || "unknown-agent";
  return `unknown-network:${userAgent}`;
}

export async function authRateScopeHashes(
  request: Request,
  normalizedIdentifier: string,
  explicitPepper?: string,
): Promise<{ identifierHash: string; ipHash: string }> {
  const identifier = normalizeScopeValue(normalizedIdentifier);
  const network = normalizeScopeValue(requestNetworkIdentity(request));
  const pepper = authRatePepper(explicitPepper);
  const [identifierHash, ipHash] = await Promise.all([
    hmacSha256Hex(pepper, `horos-auth-rate-v1:identifier:${identifier}`),
    hmacSha256Hex(pepper, `horos-auth-rate-v1:network:${network}`),
  ]);
  return { identifierHash, ipHash };
}

export function parseAuthRateLimitResult(value: unknown): AuthRateLimitResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Auth rate-limit response is invalid.");
  }
  const object = value as Record<string, unknown>;
  if (typeof object.allowed !== "boolean") {
    throw new TypeError("Auth rate-limit response has no allowed flag.");
  }
  const retryAfterSeconds = typeof object.retryAfterSeconds === "number" &&
      Number.isFinite(object.retryAfterSeconds)
    ? Math.max(0, Math.ceil(object.retryAfterSeconds))
    : 0;
  return {
    allowed: object.allowed,
    retryAfterSeconds,
    blockedBy: typeof object.blockedBy === "string" ? object.blockedBy : undefined,
  };
}
