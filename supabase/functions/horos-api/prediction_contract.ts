import type { AstroPredictionResponse, Period } from "./types.ts";

export const PREDICTION_CONTRACT = Object.freeze({
  calculationProfile: "south_indian_drik_lahiri_jpl_de440s_v1",
  classicalProfile: "varahamihira_v1",
  engineVersion: "horos_brihat_jataka_v2",
  responseVersion: "classical_prediction_response_v1",
});

export type PredictionCacheColumns = {
  calculation_profile: string;
  classical_profile: string;
  engine_version: string;
  prediction_contract_version: string;
};

export function predictionCacheColumns(): PredictionCacheColumns {
  return {
    calculation_profile: PREDICTION_CONTRACT.calculationProfile,
    classical_profile: PREDICTION_CONTRACT.classicalProfile,
    engine_version: PREDICTION_CONTRACT.engineVersion,
    prediction_contract_version: PREDICTION_CONTRACT.responseVersion,
  };
}

export function assertPredictionContract(
  payload: AstroPredictionResponse,
  expectedPeriod: Period,
): void {
  const mismatches: string[] = [];

  if (payload.calculation_profile !== PREDICTION_CONTRACT.calculationProfile) {
    mismatches.push(`calculation_profile=${payload.calculation_profile}`);
  }
  if (payload.classical_profile !== PREDICTION_CONTRACT.classicalProfile) {
    mismatches.push(`classical_profile=${payload.classical_profile}`);
  }
  if (payload.engine_version !== PREDICTION_CONTRACT.engineVersion) {
    mismatches.push(`engine_version=${payload.engine_version}`);
  }
  if (payload.period !== expectedPeriod) {
    mismatches.push(`period=${payload.period}`);
  }

  if (mismatches.length > 0) {
    throw new TypeError(`Astro prediction contract mismatch: ${mismatches.join(", ")}`);
  }
}
