const ALLOWED_HEADERS = "authorization, content-type, x-client-info, apikey";
const ALLOWED_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

function normalizedHttpOrigin(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function configuredCorsOrigins(value: string): ReadonlySet<string> {
  const origins = value
    .split(",")
    .map((item) => normalizedHttpOrigin(item))
    .filter((item): item is string => Boolean(item));
  return new Set(origins);
}

export function corsHeadersFor(
  originValue: string | null,
  configuredValue: string,
  environment: string,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  const origin = normalizedHttpOrigin(originValue);
  if (!origin) return headers;

  const allowed = environment !== "production" || configuredCorsOrigins(configuredValue).has(origin);
  if (!allowed) return headers;

  return {
    ...headers,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Max-Age": "86400",
  };
}

export function corsHeaders(request: Request): Record<string, string> {
  return corsHeadersFor(
    request.headers.get("Origin"),
    Deno.env.get("ALLOWED_ORIGINS") ?? "",
    Deno.env.get("ENVIRONMENT") ?? "development",
  );
}
