import {
  authRateScopeHashes,
  parseAuthRateLimitResult,
  requestNetworkIdentity,
} from "./auth_rate.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("Auth rate limiting prefers the trusted Cloudflare network header", () => {
  const request = new Request("https://example.com/auth/login", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.4, 198.51.100.5",
      "x-real-ip": "192.0.2.3",
    },
  });

  assertEquals(requestNetworkIdentity(request), "203.0.113.10", "network identity");
});

Deno.test("Auth rate limiting uses the first forwarded address", () => {
  const request = new Request("https://example.com/auth/login", {
    headers: { "x-forwarded-for": "198.51.100.4, 198.51.100.5" },
  });

  assertEquals(requestNetworkIdentity(request), "198.51.100.4", "forwarded identity");
});

Deno.test("Auth rate hashes are stable and separate identifier from network scope", async () => {
  const request = new Request("https://example.com/auth/login", {
    headers: { "cf-connecting-ip": "203.0.113.10" },
  });
  const first = await authRateScopeHashes(request, "User@Example.COM");
  const second = await authRateScopeHashes(request, "user@example.com");

  assertEquals(first, second, "normalized hashes");
  assertEquals(first.identifierHash.length, 64, "identifier hash length");
  assertEquals(first.ipHash.length, 64, "IP hash length");
  if (first.identifierHash === first.ipHash) {
    throw new Error("Identifier and network scopes must not share a hash namespace.");
  }
});

Deno.test("Auth rate-limit result normalizes retry metadata", () => {
  assertEquals(
    parseAuthRateLimitResult({
      allowed: false,
      retryAfterSeconds: 12.2,
      blockedBy: "identifier_15m",
    }),
    {
      allowed: false,
      retryAfterSeconds: 13,
      blockedBy: "identifier_15m",
    },
    "rate-limit result",
  );
});
