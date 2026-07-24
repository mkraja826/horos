import {
  isPhase4AnalysisEnabled,
  parseTargetMonth,
  parseTargetYear,
} from "./analysis.ts";
import {
  assertLifeProfileReportContract,
  assertMonthAnalysisReportContract,
  assertYearAnalysisReportContract,
} from "./analysis_contract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectError(callback: () => unknown): void {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error("Expected the callback to throw.");
}

function evidence(domain: string, polarity: string) {
  return {
    evidence_id: `${domain}-${polarity}`,
    domain,
    statement: `${domain} ${polarity} evidence`,
    polarity,
    weight: polarity === "contextual" ? 0 : 0.5,
    source_rule_ids: ["BJ.TEST.1"],
    source_kind: "classical",
    reason: "Frozen contract fixture.",
  };
}

function prediction(period: "natal" | "monthly", asOf: string) {
  const domains = [
    "overall",
    "career",
    "money_resources",
    "relationships_marriage",
    "family_home",
    "education_creativity",
    "wellbeing",
    "travel_change",
    "spirituality",
  ];
  return {
    engine_version: "horos_brihat_jataka_v2",
    calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
    classical_profile: "varahamihira_v1",
    period,
    as_of: asOf,
    results: domains.map((domain) => ({
      domain,
      outlook: "mixed",
      strength: "moderate",
      supporting_score: 0.5,
      challenging_score: 0.5,
      net_score: 0,
      statement: "Mixed evidence.",
      advisory: "Use balanced judgment.",
      favourable_timing: null,
      challenging_timing: null,
      supporting_factors: [evidence(domain, "supporting")],
      challenging_factors: [evidence(domain, "challenging")],
      contextual_factors: [evidence(domain, "contextual")],
    })),
    disclaimer: "Traditional interpretation only.",
  };
}

const INDEX_DOMAINS = [
  "love",
  "finance",
  "wellbeing",
  "partnership",
  "opportunity",
  "happiness",
  "overall",
] as const;
const LIFE_SECTIONS = [
  "character_temperament",
  "strengths_growth",
  "relationship_style",
  "finance_style",
  "career_style",
  "wellbeing",
  "partnership",
  "opportunity",
  "happiness",
  "overall",
] as const;

function index(domain: string) {
  return {
    domain,
    score: 50,
    band: "mixed",
    score_version: "outlook_index_v1",
    confidence_status: "uncalibrated_moderate",
    supporting_component: 0.5,
    challenging_component: 0.5,
    coverage: 1,
    conflict_status: "internal_conflict",
    evidence_refs: [`${domain}-supporting`, `${domain}-challenging`],
    disclaimer: "Not a probability or guarantee.",
  };
}

function section(name: string, withIndex = true) {
  const domain = INDEX_DOMAINS.includes(name as (typeof INDEX_DOMAINS)[number])
    ? name
    : "overall";
  return {
    section: name,
    headline: `${name} mixed`,
    narrative: "Supporting and challenging evidence are both present.",
    guidance: "Use this as reflection, not a fixed conclusion.",
    confidence_status: "uncalibrated_moderate",
    conflict_status: "internal_conflict",
    supporting_evidence: [evidence(domain, "supporting")],
    challenging_evidence: [evidence(domain, "challenging")],
    contextual_evidence: [evidence(domain, "contextual")],
    outlook_index: withIndex ? index(domain) : null,
  };
}

function monthPair(year: number, month: number) {
  const sample = `${year}-${String(month).padStart(2, "0")}-15T12:00:00[Asia/Kolkata]`;
  return {
    facts: {
      facts_version: "period_analysis_facts_v1",
      calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
      classical_profile: "varahamihira_v1",
      engine_version: "horos_brihat_jataka_v2",
      year,
      month,
      sample_local_datetime: sample,
      sampling_method: "civil_month_midpoint_local_noon_v1",
      sampling_applied: true,
      exact_boundary_calculation_applied: false,
      channels_available: ["natal_career", "active_dasha"],
      channels_unavailable: ["transit", "panchanga"],
      source_prediction: prediction("monthly", sample),
    },
    interpretation: {
      interpretation_version: "period_analysis_interpretation_v1",
      facts_version: "period_analysis_facts_v1",
      year,
      month,
      sample_local_datetime: sample,
      sampling_method: "civil_month_midpoint_local_noon_v1",
      exact_boundary_calculation_applied: false,
      channels_available: ["natal_career", "active_dasha"],
      channels_unavailable: ["transit", "panchanga"],
      indices: INDEX_DOMAINS.map(index),
      sections: INDEX_DOMAINS.map((domain) => section(domain)),
      disclaimer: "No exact event claims.",
    },
  };
}

Deno.test("Phase 4 analysis flag defaults closed", () => {
  const previous = Deno.env.get("PHASE4_ANALYSIS_ENABLED");
  Deno.env.delete("PHASE4_ANALYSIS_ENABLED");
  try {
    assert(isPhase4AnalysisEnabled() === false, "Analysis flag should default false.");
    Deno.env.set("PHASE4_ANALYSIS_ENABLED", "true");
    assert(isPhase4AnalysisEnabled() === true, "Analysis flag should accept true.");
  } finally {
    if (previous === undefined) Deno.env.delete("PHASE4_ANALYSIS_ENABLED");
    else Deno.env.set("PHASE4_ANALYSIS_ENABLED", previous);
  }
});

Deno.test("Phase 4 target year and month parsing is bounded", () => {
  assert(parseTargetYear("2028") === 2028, "Valid year was not parsed.");
  assert(parseTargetMonth("2") === 2, "Valid month was not parsed.");
  expectError(() => parseTargetYear("1899"));
  expectError(() => parseTargetYear("year"));
  expectError(() => parseTargetMonth("0"));
  expectError(() => parseTargetMonth("13"));
});

Deno.test("Life Profile report contract accepts ten safe sections", () => {
  const indexed = new Set([
    "relationship_style",
    "finance_style",
    "wellbeing",
    "partnership",
    "opportunity",
    "happiness",
    "overall",
  ]);
  const payload = {
    facts: {
      facts_version: "life_profile_facts_v1",
      calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
      classical_profile: "varahamihira_v1",
      engine_version: "horos_brihat_jataka_v2",
      as_of: "2026-07-24T12:00:00[Asia/Kolkata]",
      channels_available: ["natal_career", "active_dasha"],
      channels_unavailable: ["transit", "panchanga"],
      source_prediction: prediction("natal", "2026-07-24T12:00:00[Asia/Kolkata]"),
    },
    interpretation: {
      interpretation_version: "life_profile_interpretation_v1",
      facts_version: "life_profile_facts_v1",
      as_of: "2026-07-24T12:00:00[Asia/Kolkata]",
      sections: LIFE_SECTIONS.map((name) => section(name, indexed.has(name))),
      disclaimer: "Tendencies only, not fixed traits.",
    },
  };
  assertLifeProfileReportContract(payload);
  expectError(() =>
    assertLifeProfileReportContract({
      ...payload,
      facts: { ...payload.facts, timezone: "Asia/Kolkata" },
    })
  );
});

Deno.test("Month and year report contracts preserve twelve ordered sampled months", () => {
  const month = monthPair(2028, 2);
  assertMonthAnalysisReportContract(month, 2028, 2);

  const months = Array.from({ length: 12 }, (_, index) => monthPair(2028, index + 1));
  const year = {
    facts: {
      facts_version: "period_analysis_facts_v1",
      calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
      classical_profile: "varahamihira_v1",
      engine_version: "horos_brihat_jataka_v2",
      year: 2028,
      sampling_method: "civil_month_midpoint_local_noon_v1",
      sampling_applied: true,
      exact_boundary_calculation_applied: false,
      channels_available: ["natal_career", "active_dasha"],
      channels_unavailable: ["transit", "panchanga"],
      months: months.map((item) => item.facts),
    },
    interpretation: {
      interpretation_version: "period_analysis_interpretation_v1",
      facts_version: "period_analysis_facts_v1",
      year: 2028,
      overview_indices: INDEX_DOMAINS.map(index),
      months: months.map((item) => item.interpretation),
      strongest_months: [1, 2, 3],
      challenging_months: [10, 11, 12],
      disclaimer: "No guaranteed events.",
    },
  };
  assertYearAnalysisReportContract(year, 2028);
  expectError(() =>
    assertYearAnalysisReportContract(
      {
        ...year,
        interpretation: {
          ...year.interpretation,
          months: [...year.interpretation.months].reverse(),
        },
      },
      2028,
    )
  );
});
