import type { Phase4AnalysisKind } from "./analysis.ts";
import { adminClient } from "./db.ts";
import type { BirthDetailsRow } from "./types.ts";

export const ANALYSIS_CACHE_CONTRACT = Object.freeze({
  calculationProfile: "south_indian_drik_lahiri_jpl_de440s_v1",
  classicalProfile: "varahamihira_v1",
  engineVersion: "horos_brihat_jataka_v2",
  lifeFactsVersion: "life_profile_facts_v1",
  lifeInterpretationVersion: "life_profile_interpretation_v1",
  periodFactsVersion: "period_analysis_facts_v1",
  periodInterpretationVersion: "period_analysis_interpretation_v1",
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export function analysisPeriodKey(
  kind: Phase4AnalysisKind,
  localDate: string,
  year?: number,
  month?: number,
): string {
  if (kind === "life_profile") return `life:${localDate}`;
  if (kind === "year") return `year:${year}`;
  return `month:${year}-${String(month).padStart(2, "0")}`;
}

export async function analysisChartFingerprint(birth: BirthDetailsRow): Promise<string> {
  return await sha256(
    JSON.stringify({
      date_of_birth: birth.date_of_birth,
      time_of_birth: birth.time_of_birth,
      timezone: birth.timezone,
      latitude: birth.latitude,
      longitude: birth.longitude,
      altitude_meters: birth.altitude_meters ?? 0,
      calculation_profile: birth.calculation_profile,
    }),
  );
}

function versions(kind: Phase4AnalysisKind) {
  if (kind === "life_profile") {
    return {
      facts_version: ANALYSIS_CACHE_CONTRACT.lifeFactsVersion,
      interpretation_version: ANALYSIS_CACHE_CONTRACT.lifeInterpretationVersion,
    };
  }
  return {
    facts_version: ANALYSIS_CACHE_CONTRACT.periodFactsVersion,
    interpretation_version: ANALYSIS_CACHE_CONTRACT.periodInterpretationVersion,
  };
}

export async function readAnalysisCache(
  userId: string,
  kind: Phase4AnalysisKind,
  periodKey: string,
  chartFingerprint: string,
): Promise<Record<string, unknown> | null> {
  const contract = versions(kind);
  const result = await adminClient
    .from("phase4_analysis_cache")
    .select("content_json")
    .eq("user_id", userId)
    .eq("analysis_type", kind)
    .eq("period_key", periodKey)
    .eq("chart_fingerprint", chartFingerprint)
    .eq("calculation_profile", ANALYSIS_CACHE_CONTRACT.calculationProfile)
    .eq("classical_profile", ANALYSIS_CACHE_CONTRACT.classicalProfile)
    .eq("engine_version", ANALYSIS_CACHE_CONTRACT.engineVersion)
    .eq("facts_version", contract.facts_version)
    .eq("interpretation_version", contract.interpretation_version)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data?.content_json || typeof result.data.content_json !== "object") return null;
  return result.data.content_json as Record<string, unknown>;
}

export async function writeAnalysisCache(
  userId: string,
  kind: Phase4AnalysisKind,
  periodKey: string,
  chartFingerprint: string,
  content: Record<string, unknown>,
): Promise<void> {
  const contract = versions(kind);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const result = await adminClient.from("phase4_analysis_cache").upsert(
    {
      user_id: userId,
      analysis_type: kind,
      period_key: periodKey,
      chart_fingerprint: chartFingerprint,
      calculation_profile: ANALYSIS_CACHE_CONTRACT.calculationProfile,
      classical_profile: ANALYSIS_CACHE_CONTRACT.classicalProfile,
      engine_version: ANALYSIS_CACHE_CONTRACT.engineVersion,
      facts_version: contract.facts_version,
      interpretation_version: contract.interpretation_version,
      content_json: content,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict:
        "user_id,analysis_type,period_key,chart_fingerprint,calculation_profile,classical_profile,engine_version,facts_version,interpretation_version",
    },
  );
  if (result.error) throw result.error;
}
