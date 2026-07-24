const INDEX_DOMAINS = new Set([
  "love",
  "finance",
  "wellbeing",
  "partnership",
  "opportunity",
  "happiness",
  "overall",
]);
const LIFE_SECTIONS = new Set([
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
]);
const RAW_BIRTH_KEYS = new Set([
  "birth",
  "date_of_birth",
  "dateOfBirth",
  "time_of_birth",
  "timeOfBirth",
  "local_datetime",
  "localDateTime",
  "timezone",
  "latitude",
  "longitude",
  "altitude_meters",
  "altitudeMeters",
]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((item, index) => item !== wanted[index])) {
    throw new Error(`${label} fields do not match the pinned contract.`);
  }
}

function assertNoRawBirthKeys(value: unknown, path = "$" pronounced = false): void {
  void pronounced;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawBirthKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (RAW_BIRTH_KEYS.has(key)) {
      throw new Error(`Analysis response leaked raw birth input at ${path}.${key}.`);
    }
    assertNoRawBirthKeys(item, `${path}.${key}`);
  }
}

function assertIndex(value: unknown, expectedDomain?: string) {
  const index = object(value, "outlook index");
  const domain = index.domain;
  if (typeof domain !== "string" || !INDEX_DOMAINS.has(domain)) {
    throw new Error("Outlook index domain is invalid.");
  }
  if (expectedDomain && domain !== expectedDomain) {
    throw new Error(`Outlook index domain must be ${expectedDomain}.`);
  }
  if (index.score_version !== "outlook_index_v1") {
    throw new Error("Outlook index version is unsupported.");
  }
  if (
    index.score !== null &&
    (typeof index.score !== "number" ||
      !Number.isInteger(index.score) ||
      index.score < 0 ||
      index.score > 100)
  ) {
    throw new Error("Outlook index score is invalid.");
  }
  if (typeof index.coverage !== "number" || index.coverage < 0 || index.coverage > 1) {
    throw new Error("Outlook index coverage is invalid.");
  }
  if (!Array.isArray(index.evidence_refs)) {
    throw new Error("Outlook index evidence references are invalid.");
  }
}

function assertSections(value: unknown, expected: Set<string>) {
  const sections = array(value, "analysis sections");
  if (sections.length !== expected.size) throw new Error("Analysis section count is invalid.");
  const names = new Set<string>();
  for (const raw of sections) {
    const section = object(raw, "analysis section");
    if (typeof section.section !== "string" || !expected.has(section.section)) {
      throw new Error("Analysis section name is invalid.");
    }
    names.add(section.section);
    if (
      typeof section.headline !== "string" ||
      !section.headline.trim() ||
      typeof section.narrative !== "string" ||
      !section.narrative.trim() ||
      typeof section.guidance !== "string" ||
      !section.guidance.trim()
    ) {
      throw new Error("Analysis section copy is incomplete.");
    }
    if (
      !Array.isArray(section.supporting_evidence) ||
      !Array.isArray(section.challenging_evidence) ||
      !Array.isArray(section.contextual_evidence)
    ) {
      throw new Error("Analysis section evidence groups are invalid.");
    }
    if (section.outlook_index !== null) assertIndex(section.outlook_index);
  }
  if (names.size !== expected.size) throw new Error("Analysis sections must be unique.");
}

function assertPrediction(value: unknown, period: "natal" | "monthly") {
  const prediction = object(value, "source prediction");
  if (
    prediction.engine_version !== "horos_brihat_jataka_v2" ||
    prediction.calculation_profile !== "south_indian_drik_lahiri_jpl_de440s_v1" ||
    prediction.classical_profile !== "varahamihira_v1" ||
    prediction.period !== period
  ) {
    throw new Error("Source prediction contract is unsupported.");
  }
  if (!Array.isArray(prediction.results) || prediction.results.length === 0) {
    throw new Error("Source prediction results are missing.");
  }
}

function assertMonthPair(
  factsValue: unknown,
  interpretationValue: unknown,
  year?: number,
  month?: number,
) {
  const facts = object(factsValue, "month facts");
  const interpretation = object(interpretationValue, "month interpretation");
  if (
    facts.facts_version !== "period_analysis_facts_v1" ||
    interpretation.facts_version !== "period_analysis_facts_v1" ||
    interpretation.interpretation_version !== "period_analysis_interpretation_v1"
  ) {
    throw new Error("Month analysis versions are unsupported.");
  }
  if (
    typeof facts.year !== "number" ||
    typeof facts.month !== "number" ||
    facts.year !== interpretation.year ||
    facts.month !== interpretation.month
  ) {
    throw new Error("Month facts and interpretation period mismatch.");
  }
  if (year !== undefined && facts.year !== year) throw new Error("Month year mismatch.");
  if (month !== undefined && facts.month !== month) throw new Error("Month number mismatch.");
  if (
    facts.sampling_method !== "civil_month_midpoint_local_noon_v1" ||
    facts.sampling_applied !== true ||
    facts.exact_boundary_calculation_applied !== false ||
    interpretation.sampling_method !== facts.sampling_method ||
    interpretation.exact_boundary_calculation_applied !== false
  ) {
    throw new Error("Month sampling contract is invalid.");
  }
  const indices = array(interpretation.indices, "month indices");
  if (indices.length !== 7) throw new Error("Month analysis requires seven outlook indices.");
  const domains = new Set<string>();
  for (const index of indices) {
    assertIndex(index);
    domains.add(String(object(index, "month index").domain));
  }
  if (domains.size !== 7) throw new Error("Month outlook domains must be unique.");
  assertSections(interpretation.sections, INDEX_DOMAINS);
  assertPrediction(facts.source_prediction, "monthly");
}

export function assertLifeProfileReportContract(value: unknown) {
  const report = object(value, "life profile report");
  exactKeys(report, ["facts", "interpretation"], "life profile report");
  const facts = object(report.facts, "life profile facts");
  const interpretation = object(report.interpretation, "life profile interpretation");
  if (
    facts.facts_version !== "life_profile_facts_v1" ||
    interpretation.facts_version !== "life_profile_facts_v1" ||
    interpretation.interpretation_version !== "life_profile_interpretation_v1"
  ) {
    throw new Error("Life Profile versions are unsupported.");
  }
  assertPrediction(facts.source_prediction, "natal");
  assertSections(interpretation.sections, LIFE_SECTIONS);
  assertNoRawBirthKeys(report);
}

export function assertMonthAnalysisReportContract(value: unknown, year: number, month: number) {
  const report = object(value, "month analysis report");
  exactKeys(report, ["facts", "interpretation"], "month analysis report");
  assertMonthPair(report.facts, report.interpretation, year, month);
  assertNoRawBirthKeys(report);
}

export function assertYearAnalysisReportContract(value: unknown, year: number) {
  const report = object(value, "year analysis report");
  exactKeys(report, ["facts", "interpretation"], "year analysis report");
  const facts = object(report.facts, "year facts");
  const interpretation = object(report.interpretation, "year interpretation");
  if (
    facts.facts_version !== "period_analysis_facts_v1" ||
    interpretation.facts_version !== "period_analysis_facts_v1" ||
    interpretation.interpretation_version !== "period_analysis_interpretation_v1" ||
    facts.year !== year ||
    interpretation.year !== year
  ) {
    throw new Error("Year analysis versions or target year are invalid.");
  }
  const factMonths = array(facts.months, "year fact months");
  const interpretationMonths = array(interpretation.months, "year interpretation months");
  if (factMonths.length !== 12 || interpretationMonths.length !== 12) {
    throw new Error("Year analysis requires twelve months.");
  }
  for (let index = 0; index < 12; index += 1) {
    assertMonthPair(factMonths[index], interpretationMonths[index], year, index + 1);
  }
  const overview = array(interpretation.overview_indices, "year overview indices");
  if (overview.length !== 7) throw new Error("Year analysis requires seven overview indices.");
  overview.forEach((item) => assertIndex(item));
  if (
    !Array.isArray(interpretation.strongest_months) ||
    !Array.isArray(interpretation.challenging_months) ||
    interpretation.strongest_months.length > 3 ||
    interpretation.challenging_months.length > 3
  ) {
    throw new Error("Year strongest/challenging month lists are invalid.");
  }
  assertNoRawBirthKeys(report);
}
