import { configuredCorsOrigins, corsHeadersFor } from "./cors.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("Production CORS allows an exact configured origin", () => {
  const headers = corsHeadersFor(
    "https://app.horos.example",
    "https://app.horos.example/, https://admin.horos.example",
    "production",
  );

  assertEquals(headers["Access-Control-Allow-Origin"], "https://app.horos.example", "allowed origin");
  assertEquals(
    headers["Access-Control-Allow-Headers"],
    "authorization, content-type, x-client-info, apikey",
    "allowed headers",
  );
  assertEquals(headers.Vary, "Origin", "vary header");
});

Deno.test("Production CORS gives an unapproved origin no access-control trust headers", () => {
  const headers = corsHeadersFor(
    "https://evil.example",
    "https://app.horos.example",
    "production",
  );

  assertEquals(headers, { Vary: "Origin" }, "blocked origin headers");
});

Deno.test("Production CORS fails closed when no origins are configured", () => {
  const headers = corsHeadersFor("https://app.horos.example", "", "production");
  assertEquals(headers, { Vary: "Origin" }, "unconfigured production headers");
});

Deno.test("Development CORS echoes a valid browser origin", () => {
  const headers = corsHeadersFor("http://localhost:8081", "", "development");
  assertEquals(headers["Access-Control-Allow-Origin"], "http://localhost:8081", "development origin");
});

Deno.test("Requests without a browser origin receive no wildcard CORS header", () => {
  const headers = corsHeadersFor(null, "https://app.horos.example", "production");
  assertEquals(headers, { Vary: "Origin" }, "non-browser headers");
});

Deno.test("Non-HTTP origins are not trusted", () => {
  const headers = corsHeadersFor("null", "null", "development");
  assertEquals(headers, { Vary: "Origin" }, "opaque origin headers");
});

Deno.test("Configured CORS origins are canonicalized and deduplicated", () => {
  const origins = configuredCorsOrigins(
    "https://app.horos.example/, https://app.horos.example, javascript:alert(1)",
  );
  assertEquals([...origins], ["https://app.horos.example"], "configured origins");
});
