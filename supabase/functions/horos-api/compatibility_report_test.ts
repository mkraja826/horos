import { AstroProviderError } from "./astro.ts";
import { assertCompatibilityReportContract } from "./compatibility_report_contract.ts";

function expectReportContractError(callback: () => unknown): void {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof AstroProviderError)) throw error;
    if (error.providerCode !== "COMPATIBILITY_REPORT_CONTRACT_MISMATCH") {
      throw new Error(`Unexpected provider code ${String(error.providerCode)}.`);
    }
    return;
  }
  throw new Error("Expected a compatibility report contract error.");
}

const MAXIMUMS = new Map([
  ["varna", 1],
  ["vashya", 2],
  ["tara", 3],
  ["yoni", 4],
  ["graha_maitri", 5],
  ["gana", 6],
  ["bhakoot", 7],
  ["nadi", 8],
]);

function manglik(reference: string, flagged: boolean) {
  return {
    reference_point: reference,
    mars_house: flagged ? 7 : 3,
    flagged,
    rule_ids: ["ASTRO-CONV-MANGLIK-HOUSE-FACTS-001"],
  };
}

function factsPayload(complete: boolean) {
  const directional = new Set(["varna", "vashya", "gana"]);
  const components = [...MAXIMUMS.entries()].map(([component, maximum]) => {
    const abstained = !complete && directional.has(component);
    return {
      component,
      status: abstained ? "abstained" : "evaluated",
      achieved_points: abstained ? null : maximum / 2,
      maximum_points: maximum,
      rule_ids: [`ASTRO-${component.toUpperCase()}`],
      abstention_reason: abstained ? "Traditional roles were absent." : null,
    };
  });
  return {
    facts_version: "compatibility_facts_v2",
    compatibility_profile: "ashtakoota_v2",
    calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
    subject_fingerprint: "a".repeat(64),
    partner_fingerprint: "b".repeat(64),
    pair_fingerprint: "c".repeat(64),
    ashtakoota_components: components,
    total_achieved_points: components.reduce(
      (total, item) => total + (typeof item.achieved_points === "number" ? item.achieved_points : 0),
      0,
    ),
    evaluated_maximum_points: complete ? 36 : 27,
    total_maximum_points: 36,
    complete_36_point_evaluation: complete,
    subject_manglik_factors: [
      manglik("lagna", true),
      manglik("moon", false),
      manglik("venus", true),
    ],
    partner_manglik_factors: [
      manglik("lagna", false),
      manglik("moon", false),
      manglik("venus", true),
    ],
    rule_ids: ["ASTRO-COMPATIBILITY-FACTS-ASSEMBLER-001"],
    metadata: { engine: "jyothisyam-api" },
  };
}

function reportPayload(complete: boolean) {
  const facts = factsPayload(complete);
  const components = facts.ashtakoota_components.map((fact) => {
    const ratio = typeof fact.achieved_points === "number"
      ? fact.achieved_points / fact.maximum_points
      : null;
    return {
      component: fact.component,
      status: fact.status,
      achieved_points: fact.achieved_points,
      maximum_points: fact.maximum_points,
      ratio,
      band: ratio === null ? "insufficient" : ratio >= 0.75 ? "supportive" : ratio >= 0.4 ? "mixed" : "challenging",
      headline: `${fact.component} comparison`,
      explanation: "Traditional comparison context only.",
      evidence_refs: fact.rule_ids,
    };
  });
  return {
    facts,
    interpretation: {
      interpretation_version: "compatibility_interpretation_v1",
      facts_version: "compatibility_facts_v2",
      evaluated_maximum_points: complete ? 36 : 27,
      complete_36_point_evaluation: complete,
      partnership_index: {
        domain: "partnership",
        score: 50,
        band: "mixed",
        score_version: "outlook_index_v1",
        confidence_status: complete ? "uncalibrated_moderate" : "uncalibrated_low",
        supporting_component: 0.5,
        challenging_component: 0.5,
        coverage: complete ? 1 : 0.75,
        conflict_status: "none",
        evidence_refs: ["ASTRO-COMPATIBILITY-FACTS-ASSEMBLER-001"],
        disclaimer: "This is not a probability.",
      },
      components,
      strengths: [],
      cautions: complete ? [] : ["The comparison is partial."],
      manglik_context: {
        subject_flagged_count: 2,
        partner_flagged_count: 1,
        comparison: "Context only; not an automatic rejection rule.",
        evidence_refs: ["ASTRO-CONV-MANGLIK-HOUSE-FACTS-001"],
        disclaimer: "Manglik placements are contextual factors.",
      },
      disclaimer: "This report does not predict marriage success or failure.",
    },
  };
}

Deno.test("Compatibility report contract accepts complete 36-point envelope", () => {
  assertCompatibilityReportContract(reportPayload(true), true);
});

Deno.test("Compatibility report contract accepts partial 27-point envelope", () => {
  assertCompatibilityReportContract(reportPayload(false), false);
});

Deno.test("Compatibility report contract rejects interpretation coverage drift", () => {
  const invalid = reportPayload(false);
  invalid.interpretation.partnership_index.coverage = 1;
  expectReportContractError(() => assertCompatibilityReportContract(invalid, false));
});

Deno.test("Compatibility report contract rejects changed interpreted component points", () => {
  const invalid = reportPayload(true);
  invalid.interpretation.components[0].achieved_points = 0;
  expectReportContractError(() => assertCompatibilityReportContract(invalid, true));
});

Deno.test("Compatibility report contract preserves abstention as null", () => {
  const invalid = reportPayload(false);
  invalid.interpretation.components[0].achieved_points = 0;
  invalid.interpretation.components[0].ratio = 0;
  expectReportContractError(() => assertCompatibilityReportContract(invalid, false));
});

Deno.test("Compatibility report contract rejects unsupported interpretation version", () => {
  const invalid = reportPayload(true);
  invalid.interpretation.interpretation_version = "compatibility_interpretation_v2";
  expectReportContractError(() => assertCompatibilityReportContract(invalid, true));
});
