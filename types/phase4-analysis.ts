export type OutlookDomain =
  | "love"
  | "finance"
  | "wellbeing"
  | "partnership"
  | "opportunity"
  | "happiness"
  | "overall";

export type ConfidenceStatus =
  | "insufficient"
  | "uncalibrated_low"
  | "uncalibrated_moderate";

export type ConflictStatus =
  | "none"
  | "internal_conflict"
  | "cross_channel_conflict"
  | "insufficient";

export type OutlookIndex = {
  domain: OutlookDomain;
  score: number | null;
  band:
    | "very_challenging"
    | "challenging"
    | "mixed"
    | "supportive"
    | "very_supportive"
    | null;
  score_version: "outlook_index_v1";
  confidence_status: ConfidenceStatus;
  supporting_component: number;
  challenging_component: number;
  coverage: number;
  conflict_status: ConflictStatus;
  evidence_refs: string[];
  disclaimer: string;
};

export type AnalysisEvidence = {
  evidence_id: string;
  domain: string;
  statement: string;
  polarity: "supporting" | "challenging" | "contextual";
  weight: number;
  source_rule_ids: string[];
  source_kind: "classical" | "convention";
  reason: string;
};

export type AnalysisSection = {
  section: string;
  headline: string;
  narrative: string;
  guidance: string;
  confidence_status: ConfidenceStatus;
  conflict_status: ConflictStatus;
  supporting_evidence: AnalysisEvidence[];
  challenging_evidence: AnalysisEvidence[];
  contextual_evidence: AnalysisEvidence[];
  outlook_index: OutlookIndex | null;
};

export type ProviderEnvelope = {
  generatedAt: string;
  calculationMode: "provider";
  provider: { requestId: string };
};

export type LifeProfileReport = ProviderEnvelope & {
  facts: {
    facts_version: "life_profile_facts_v1";
    calculation_profile: string;
    classical_profile: "varahamihira_v1";
    engine_version: "horos_brihat_jataka_v2";
    as_of: string;
    channels_available: string[];
    channels_unavailable: string[];
  };
  interpretation: {
    interpretation_version: "life_profile_interpretation_v1";
    facts_version: "life_profile_facts_v1";
    as_of: string;
    sections: AnalysisSection[];
    disclaimer: string;
  };
};

export type MonthAnalysis = {
  interpretation_version: "period_analysis_interpretation_v1";
  facts_version: "period_analysis_facts_v1";
  year: number;
  month: number;
  sample_local_datetime: string;
  sampling_method: "civil_month_midpoint_local_noon_v1";
  exact_boundary_calculation_applied: false;
  channels_available: string[];
  channels_unavailable: string[];
  indices: OutlookIndex[];
  sections: AnalysisSection[];
  disclaimer: string;
};

export type MonthAnalysisReport = ProviderEnvelope & {
  facts: {
    facts_version: "period_analysis_facts_v1";
    calculation_profile: string;
    classical_profile: "varahamihira_v1";
    engine_version: "horos_brihat_jataka_v2";
    year: number;
    month: number;
    sample_local_datetime: string;
    sampling_method: "civil_month_midpoint_local_noon_v1";
    sampling_applied: true;
    exact_boundary_calculation_applied: false;
    channels_available: string[];
    channels_unavailable: string[];
  };
  interpretation: MonthAnalysis;
};

export type YearAnalysisReport = ProviderEnvelope & {
  facts: {
    facts_version: "period_analysis_facts_v1";
    calculation_profile: string;
    classical_profile: "varahamihira_v1";
    engine_version: "horos_brihat_jataka_v2";
    year: number;
    sampling_method: "civil_month_midpoint_local_noon_v1";
    sampling_applied: true;
    exact_boundary_calculation_applied: false;
    channels_available: string[];
    channels_unavailable: string[];
  };
  interpretation: {
    interpretation_version: "period_analysis_interpretation_v1";
    facts_version: "period_analysis_facts_v1";
    year: number;
    overview_indices: OutlookIndex[];
    months: MonthAnalysis[];
    strongest_months: number[];
    challenging_months: number[];
    disclaimer: string;
  };
};
