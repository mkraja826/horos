import {
  AstroProviderError,
  buildAstroProviderHeaders,
  normalizeBirthTime,
} from "./astro.ts";
import type { CompatibilityRequestInput } from "./compatibility.ts";
import {
  assertCompatibilityFactsContract,
  COMPATIBILITY_CALCULATION_PROFILE,
} from "./compatibility_contract.ts";
import { assertCompatibilityReportContract } from "./compatibility_report_contract.ts";
import type { BirthDetailsRow } from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompatibilityProviderPath = "facts" | "report";

function providerUrl(): string {
  const value = Deno.env.get("ASTRO_API_URL")?.trim().replace(/\/$/, "");
  if (!value) throw new AstroProviderError("The JPL Astro calculation API is not configured.", 503);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AstroProviderError("The JPL Astro calculation API URL is invalid.", 503);
  }
  if ((Deno.env.get("ENVIRONMENT") ?? "development") === "production" && parsed.protocol !== "https:") {
    throw new AstroProviderError("The JPL Astro calculation API must use HTTPS.", 503);
  }
  return value;
}

function providerKey(): string {
  const value = Deno.env.get("ASTRO_API_KEY")?.trim();
  if (!value) throw new AstroProviderError("The JPL Astro service credential is not configured.", 503);
  return value;
}

function consumerId(value: string): string {
  const normalized = value.trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new AstroProviderError("The Horos consumer identity is invalid.", 500);
  }
  return normalized;
}

function providerErrorDetails(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const object = payload as Record<string, unknown>;
  return {
    code: typeof object.code === "string" ? object.code : undefined,
    message: typeof object.message === "string"
      ? object.message
      : typeof object.detail === "string"
      ? object.detail
      : undefined,
  };
}

function storedBirthPayload(birth: BirthDetailsRow) {
  return {
    local_datetime: `${birth.date_of_birth}T${normalizeBirthTime(birth.time_of_birth)}`,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
    altitude_meters: birth.altitude_meters ?? 0,
  };
}

export function buildCompatibilityProviderBody(
  subjectBirth: BirthDetailsRow,
  request: CompatibilityRequestInput,
): Record<string, unknown> {
  return {
    subject_birth: storedBirthPayload(subjectBirth),
    partner_birth: {
      local_datetime: `${request.partnerBirth.dateOfBirth}T${request.partnerBirth.timeOfBirth}`,
      timezone: request.partnerBirth.timezone,
      latitude: request.partnerBirth.latitude,
      longitude: request.partnerBirth.longitude,
      altitude_meters: request.partnerBirth.altitudeMeters,
    },
    subject_role: request.subjectRole,
    partner_role: request.partnerRole,
    calculation_profile: COMPATIBILITY_CALCULATION_PROFILE,
  };
}

async function requestCompatibility(
  path: CompatibilityProviderPath,
  body: Record<string, unknown>,
  astroConsumerId: string,
): Promise<{ payload: Record<string, unknown>; requestId: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const requestId = `horos-${crypto.randomUUID()}`;
  try {
    const response = await fetch(
      `${providerUrl()}/v1/classical/varahamihira_v1/compatibility/${path}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: buildAstroProviderHeaders(
          providerKey(),
          consumerId(astroConsumerId),
          requestId,
        ),
        body: JSON.stringify(body),
      },
    );
    const responseRequestId = response.headers.get("x-request-id")?.trim() || requestId;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const details = providerErrorDetails(payload);
      throw new AstroProviderError(
        details.message ?? `Astro API returned HTTP ${response.status}.`,
        502,
        response.status,
        details.code,
        responseRequestId,
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AstroProviderError(
        "The Astro compatibility response is invalid.",
        502,
        response.status,
        "COMPATIBILITY_CONTRACT_MISMATCH",
        responseRequestId,
      );
    }
    return { payload: payload as Record<string, unknown>, requestId: responseRequestId };
  } catch (error) {
    if (error instanceof AstroProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AstroProviderError(
        "The JPL Astro compatibility API timed out.",
        504,
        undefined,
        undefined,
        requestId,
      );
    }
    throw new AstroProviderError(
      error instanceof Error ? error.message : "The JPL Astro compatibility API is unavailable.",
      502,
      undefined,
      undefined,
      requestId,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function providerEnvelope(payload: Record<string, unknown>, requestId: string) {
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    calculationMode: "provider" as const,
    provider: { requestId },
  };
}

export async function calculateCompatibilityFacts(
  subjectBirth: BirthDetailsRow,
  request: CompatibilityRequestInput,
  astroConsumerId: string,
) {
  const response = await requestCompatibility(
    "facts",
    buildCompatibilityProviderBody(subjectBirth, request),
    astroConsumerId,
  );
  const expectComplete = request.subjectRole !== "unspecified";
  assertCompatibilityFactsContract(response.payload, expectComplete);
  return providerEnvelope({ facts: response.payload }, response.requestId);
}

export async function calculateCompatibilityReport(
  subjectBirth: BirthDetailsRow,
  request: CompatibilityRequestInput,
  astroConsumerId: string,
) {
  const response = await requestCompatibility(
    "report",
    buildCompatibilityProviderBody(subjectBirth, request),
    astroConsumerId,
  );
  const expectComplete = request.subjectRole !== "unspecified";
  assertCompatibilityReportContract(response.payload, expectComplete);
  return providerEnvelope(response.payload, response.requestId);
}
