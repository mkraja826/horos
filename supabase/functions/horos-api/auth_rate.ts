export type AuthRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  blockedBy?: string;
};

function normalizeScopeValue(value: string): string {
  return value.trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
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
): Promise<{ identifierHash: string; ipHash: string }> {
  const identifier = normalizeScopeValue(normalizedIdentifier);
  const network = normalizeScopeValue(requestNetworkIdentity(request));
  const [identifierHash, ipHash] = await Promise.all([
    sha256Hex(`horos-auth-rate-v1:identifier:${identifier}`),
    sha256Hex(`horos-auth-rate-v1:network:${network}`),
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
