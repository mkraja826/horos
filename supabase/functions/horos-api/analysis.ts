import { ResponseError } from "./errors.ts";

export type Phase4AnalysisKind = "life_profile" | "month" | "year";

export function isPhase4AnalysisEnabled(): boolean {
  return Deno.env.get("PHASE4_ANALYSIS_ENABLED")?.trim().toLowerCase() === "true";
}

export function parseTargetYear(value: string | null): number {
  const normalized = value?.trim() ?? "";
  if (!/^\d{4}$/.test(normalized)) {
    throw new ResponseError("A four-digit target year is required.", 400, "INVALID_TARGET_YEAR");
  }
  const year = Number(normalized);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new ResponseError(
      "The target year must be between 1900 and 2200.",
      400,
      "INVALID_TARGET_YEAR",
    );
  }
  return year;
}

export function parseTargetMonth(value: string | null): number {
  const normalized = value?.trim() ?? "";
  if (!/^\d{1,2}$/.test(normalized)) {
    throw new ResponseError("A numeric target month is required.", 400, "INVALID_TARGET_MONTH");
  }
  const month = Number(normalized);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ResponseError(
      "The target month must be between 1 and 12.",
      400,
      "INVALID_TARGET_MONTH",
    );
  }
  return month;
}
