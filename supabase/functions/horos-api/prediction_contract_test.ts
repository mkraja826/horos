import {
  assertPredictionContract,
  PREDICTION_CONTRACT,
  predictionCacheColumns,
} from "./prediction_contract.ts";
import type { AstroPredictionResponse } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function prediction(overrides: Partial<AstroPredictionResponse> = {}): AstroPredictionResponse {
  return {
    engine_version: PREDICTION_CONTRACT.engineVersion,
    calculation_profile: PREDICTION_CONTRACT.calculationProfile,
    classical_profile: PREDICTION_CONTRACT.classicalProfile,
    period: "daily",
    as_of: "2026-07-23T12:00:00[Asia/Kolkata]",
    results: [],
    disclaimer: "Traditional astrology guidance only.",
    ...overrides,
  };
}

Deno.test("Prediction cache columns preserve every contract version", () => {
  assertEquals(
    predictionCacheColumns(),
    {
      calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
      classical_profile: "varahamihira_v1",
      engine_version: "horos_brihat_jataka_v2",
      prediction_contract_version: "classical_prediction_response_v1",
    },
    "cache contract columns",
  );
});

Deno.test("Prediction contract accepts the pinned Astro response", () => {
  assertPredictionContract(prediction(), "daily");
});

Deno.test("Prediction contract rejects an unexpected engine release", () => {
  let message = "";
  try {
    assertPredictionContract(prediction({ engine_version: "horos_brihat_jataka_v3" }), "daily");
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  if (!message.includes("engine_version=horos_brihat_jataka_v3")) {
    throw new Error(`Expected engine mismatch, received: ${message}`);
  }
});

Deno.test("Prediction contract rejects a provider period mismatch", () => {
  let message = "";
  try {
    assertPredictionContract(prediction({ period: "weekly" }), "daily");
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  if (!message.includes("period=weekly")) {
    throw new Error(`Expected period mismatch, received: ${message}`);
  }
});
