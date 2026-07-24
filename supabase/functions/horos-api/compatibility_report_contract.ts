import { AstroProviderError } from "./astro.ts";
import { assertCompatibilityFactsContract } from "./compatibility_contract.ts";

export const COMPATIBILITY_INTERPRETATION_VERSION = "compatibility_interpretation_v1";
export const COMPATIBILITY_OUTLOOK_VERSION = "outlook_index_v1";

const COMPONENTS = new Set([
  "varna",
  "vashya",
  "tara",
  "yoni",
  "graha_maitri",
  "gana",
  "bhakoot",
  "nadi",
]);
const COMPONENT_BANDS = new Set(["insufficient", "challenging", "mixed", "supportive"]);
const OUTLOOK_BANDS = new Set([
  "very_challenging",
  "challenging",
  "mixed",
  "supportive",
  "very_supportive",
]);
const CONFIDENCE_STATUSES = new Set([
  "insufficient",
  "uncalibrated_low",
  "uncalibrated_moderate",
]);
const CONFLICT_STATUSES = new Set([
  "none",
  "internal_conflict",
  "cross_channel_conflict",
  "insufficient",
]);

function contractError(message: string): never {
  throw new AstroProviderError(
    message,
    502,
    undefined,
    "COMPATIBILITY_REPORT_CONTRACT_MISMATCH",
  );
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return contractError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) return contractError(`${label} must be an array.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return contractError(`${label} must be a non-empty string.`);
  }
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return contractError(`${label} must be a finite number.`);
  }
  return value;
}

function integerValue(value: unknown, label: string): number {
  const number = numberValue(value, label);
  if (!Number.isInteger(number)) return contractError(`${label} must be an integer.`);
  return number;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") return contractError(`${label} must be a boolean.`);
  return value;
}

function assertStringArray(value: unknown, label: string, allowEmpty = false): void {
  const items = arrayValue(value, label);
  if ((!allowEmpty && items.length === 0) || items.some((item) => typeof item !== "string" || !item.trim())) {
    contractError(`${label} must contain non-empty strings.`);
  }
}

function assertOutlookIndex(
  value: unknown,
  expectedCoverage: number,
  expectComplete: boolean,
): void {
  const index = objectValue(value, "Partnership index");
  if (index.domain !== "partnership" || index.score_version !== COMPATIBILITY_OUTLOOK_VERSION) {
    contractError("The partnership index version or domain is unsupported.");
  }
  const score = index.score;
  const band = index.band;
  if (score === null || band === null) {
    if (score !== null || band !== null) {
      contractError("The partnership index score and band must abstain together.");
    }
  } else {
    const numericScore = integerValue(score, "Partnership index score");
    if (numericScore < 0 || numericScore > 100 || !OUTLOOK_BANDS.has(stringValue(band, "Partnership index band"))) {
      contractError("The partnership index score or band is invalid.");
    }
  }
  const confidence = stringValue(index.confidence_status, "Partnership confidence");
  if (!CONFIDENCE_STATUSES.has(confidence)) {
    contractError("The partnership confidence status is unsupported.");
  }
  const conflict = stringValue(index.conflict_status, "Partnership conflict status");
  if (!CONFLICT_STATUSES.has(conflict)) {
    contractError("The partnership conflict status is unsupported.");
  }
  for (const [field, raw] of [
    ["supporting_component", index.supporting_component],
    ["challenging_component", index.challenging_component],
    ["coverage", index.coverage],
  ] as const) {
    const number = numberValue(raw, `Partnership ${field}`);
    if (number < 0 || number > 1) contractError(`Partnership ${field} is out of range.`);
  }
  if (Math.abs(numberValue(index.coverage, "Partnership coverage") - expectedCoverage) > 1e-6) {
    contractError("The partnership index coverage is inconsistent.");
  }
  const expectedConfidence = expectComplete ? "uncalibrated_moderate" : "uncalibrated_low";
  if (confidence !== expectedConfidence) {
    contractError("The partnership confidence does not match report completeness.");
  }
  assertStringArray(index.evidence_refs, "Partnership evidence references");
  stringValue(index.disclaimer, "Partnership disclaimer");
}

function assertInterpretationComponents(
  value: unknown,
  facts: Record<string, unknown>,
): void {
  const interpretations = arrayValue(value, "Compatibility interpretations");
  const factItems = arrayValue(facts.ashtakoota_components, "Fact components");
  if (interpretations.length !== 8 || factItems.length !== 8) {
    contractError("The compatibility report must contain eight interpreted components.");
  }
  const factByName = new Map<string, Record<string, unknown>>();
  for (const rawFact of factItems) {
    const fact = objectValue(rawFact, "Fact component");
    factByName.set(stringValue(fact.component, "Fact component name"), fact);
  }
  const seen = new Set<string>();
  for (const rawInterpretation of interpretations) {
    const item = objectValue(rawInterpretation, "Component interpretation");
    const component = stringValue(item.component, "Interpreted component name");
    if (!COMPONENTS.has(component) || seen.has(component)) {
      contractError("The report contains an unknown or duplicate interpreted component.");
    }
    seen.add(component);
    const fact = factByName.get(component);
    if (!fact) contractError("The interpreted component has no matching fact.");
    const status = stringValue(item.status, `${component} interpretation status`);
    if (status !== fact.status) contractError(`${component} interpretation status changed.`);
    if (integerValue(item.maximum_points, `${component} interpreted maximum`) !== fact.maximum_points) {
      contractError(`${component} interpretation maximum changed.`);
    }
    if (status === "evaluated") {
      if (numberValue(item.achieved_points, `${component} interpreted points`) !== fact.achieved_points) {
        contractError(`${component} interpretation points changed.`);
      }
      const ratio = numberValue(item.ratio, `${component} interpretation ratio`);
      if (ratio < 0 || ratio > 1) contractError(`${component} interpretation ratio is invalid.`);
    } else if (status === "abstained") {
      if (item.achieved_points !== null || item.ratio !== null) {
        contractError(`${component} abstention was converted into a score.`);
      }
    } else {
      contractError(`${component} interpretation status is unsupported.`);
    }
    const band = stringValue(item.band, `${component} interpretation band`);
    if (!COMPONENT_BANDS.has(band)) contractError(`${component} interpretation band is unsupported.`);
    stringValue(item.headline, `${component} headline`);
    stringValue(item.explanation, `${component} explanation`);
    assertStringArray(item.evidence_refs, `${component} evidence references`);
  }
  if (seen.size !== COMPONENTS.size) {
    contractError("The interpreted component set is incomplete.");
  }
}

function assertManglikContext(value: unknown): void {
  const context = objectValue(value, "Manglik context");
  for (const field of ["subject_flagged_count", "partner_flagged_count"] as const) {
    const count = integerValue(context[field], `Manglik ${field}`);
    if (count < 0 || count > 3) contractError(`Manglik ${field} is out of range.`);
  }
  stringValue(context.comparison, "Manglik comparison");
  assertStringArray(context.evidence_refs, "Manglik evidence references");
  stringValue(context.disclaimer, "Manglik disclaimer");
}

export function assertCompatibilityReportContract(
  payload: unknown,
  expectComplete: boolean,
): asserts payload is Record<string, unknown> {
  const report = objectValue(payload, "Astro compatibility report");
  const facts = objectValue(report.facts, "Compatibility report facts");
  assertCompatibilityFactsContract(facts, expectComplete);
  const interpretation = objectValue(report.interpretation, "Compatibility interpretation");
  if (
    interpretation.interpretation_version !== COMPATIBILITY_INTERPRETATION_VERSION ||
    interpretation.facts_version !== facts.facts_version
  ) {
    contractError("The compatibility interpretation version is unsupported.");
  }
  const expectedMaximum = expectComplete ? 36 : 27;
  if (
    integerValue(interpretation.evaluated_maximum_points, "Interpreted maximum") !== expectedMaximum ||
    booleanValue(interpretation.complete_36_point_evaluation, "Interpreted completeness") !== expectComplete
  ) {
    contractError("The compatibility interpretation coverage is inconsistent.");
  }
  assertOutlookIndex(
    interpretation.partnership_index,
    expectedMaximum / 36,
    expectComplete,
  );
  assertInterpretationComponents(interpretation.components, facts);
  assertStringArray(interpretation.strengths, "Compatibility strengths", true);
  assertStringArray(interpretation.cautions, "Compatibility cautions", true);
  assertManglikContext(interpretation.manglik_context);
  stringValue(interpretation.disclaimer, "Compatibility report disclaimer");
}
