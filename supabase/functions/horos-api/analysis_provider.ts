import {
  AstroProviderError,
  buildAstroProviderHeaders,
  normalizeBirthTime,
} from "./astro.ts";
import {
  assertLifeProfileReportContract,
  assertMonthAnalysisReportContract,
  assertYearAnalysisReportContract,
} from "./analysis_contract.ts";
import type { BirthDetailsRow } from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CALCULATION_PROFILE = "south_indian_drik_lahiri_jpl_de440s_v1";

type AnalysisProviderPath =
  | "life-profile/report"
  | "month/report"
  | "year/report";

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

function storedBirthPayload(birth: BirthDetailsRow) {
  return {
    local_datetime: `${birth.date_of_birth}T${normalizeBirthTime(birth.time_of_birth)}`,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
    altitude_meters: birth.altitude_meters ?? 0,
  };
}

function providerErrorDetails(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const value = payload as Record<string, unknown>;
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string"
      ? value.message
      : typeof value.detail === "string"
      ? value.detail
      : undefined,
  };
}

async function requestAnalysis(
  path: AnalysisProviderPath,
  body: Record<string, unknown>,
  astroConsumerId: string,
): Promise<{ payload: Record<string, unknown>; requestId: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path === "year/report" ? 55_000 : 30_000);
  const requestId = `horos-${crypto.randomUUID()}`;
  try {
    const response = await fetch(
      `${providerUrl()}/v1/classical/varahamihira_v1/analysis/${path}`,
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
        "The Astro Phase 4 analysis response is invalid.",
        502,
        response.status,
        "PHASE4_ANALYSIS_CONTRACT_MISMATCH",
        responseRequestId,
      );
    }
    return { payload: payload as Record<string, unknown>, requestId: responseRequestId };
  } catch (error) {
    if (error instanceof AstroProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AstroProviderError(
        "The JPL Astro Phase 4 analysis API timed out.",
        504,
        undefined,
        undefined,
        requestId,
      );
    }
    throw new AstroProviderError(
      error instanceof Error ? error.message : "The JPL Astro Phase 4 analysis API is unavailable.",
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

export async function calculateLifeProfileReport(
  birth: BirthDetailsRow,
  localDate: string,
  astroConsumerId: string,
) {
  const response = await requestAnalysis(
    "life-profile/report",
    {
      birth: storedBirthPayload(birth),
      as_of: {
        local_datetime: `${localDate}T12:00:00`,
        timezone: birth.timezone,
      },
      calculation_profile: CALCULATION_PROFILE,
    },
    astroConsumerId,
  );
  assertLifeProfileReportContract(response.payload);
  return providerEnvelope(response.payload, response.requestId);
}

export async function calculateMonthAnalysisReport(
  birth: BirthDetailsRow,
  year: number,
  month: number,
  astroConsumerId: string,
) {
  const response = await requestAnalysis(
    "month/report",
    {
      birth: storedBirthPayload(birth),
      year,
      month,
      calculation_profile: CALCULATION_PROFILE,
    },
    astroConsumerId,
  );
  assertMonthAnalysisReportContract(response.payload, year, month);
  return providerEnvelope(response.payload, response.requestId);
}

export async function calculateYearAnalysisReport(
  birth: BirthDetailsRow,
  year: number,
  astroConsumerId: string,
) {
  const response = await requestAnalysis(
    "year/report",
    {
      birth: storedBirthPayload(birth),
      year,
      calculation_profile: CALCULATION_PROFILE,
    },
    astroConsumerId,
  );
  assertYearAnalysisReportContract(response.payload, year);
  return providerEnvelope(response.payload, response.requestId);
}
