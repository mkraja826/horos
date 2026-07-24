import { AstroProviderError } from "./astro.ts";

export const COMPATIBILITY_FACTS_VERSION = "compatibility_facts_v2";
export const COMPATIBILITY_PROFILE = "ashtakoota_v2";
export const COMPATIBILITY_CALCULATION_PROFILE = "south_indian_drik_lahiri_jpl_de440s_v1";

const COMPONENT_MAXIMUMS = new Map([
  ["varna", 1],
  ["vashya", 2],
  ["tara", 3],
  ["yoni", 4],
  ["graha_maitri", 5],
  ["gana", 6],
  ["bhakoot", 7],
  ["nadi", 8],
]);
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const MANGLIK_REFERENCES = new Set(["lagna", "moon", "venus"]);

function contractError(message: string): never {
  throw new AstroProviderError(
    message,
    502,
    undefined,
    "COMPATIBILITY_CONTRACT_MISMATCH",
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

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") return contractError(`${label} must be a boolean.`);
  return value;
}

function assertFingerprint(value: unknown, label: string): void {
  if (!FINGERPRINT_PATTERN.test(stringValue(value, label))) {
    contractError(`${label} must be a SHA-256 fingerprint.`);
  }
}

function assertStringArray(value: unknown, label: string): void {
  const items = arrayValue(value, label);
  if (items.length === 0 || items.some((item) => typeof item !== "string" || !item.trim())) {
    contractError(`${label} must contain non-empty strings.`);
  }
}

function assertComponents(
  value: unknown,
  expectedEvaluatedMaximum: number,
): number {
  const items = arrayValue(value, "Ashtakoota components");
  if (items.length !== COMPONENT_MAXIMUMS.size) {
    contractError("The Astro compatibility response must contain all eight components.");
  }

  const seen = new Set<string>();
  let achievedTotal = 0;
  let evaluatedMaximum = 0;
  for (const [index, rawItem] of items.entries()) {
    const item = objectValue(rawItem, `Ashtakoota component ${index + 1}`);
    const component = stringValue(item.component, `Ashtakoota component ${index + 1} name`);
    const expectedMaximum = COMPONENT_MAXIMUMS.get(component);
    if (!expectedMaximum || seen.has(component)) {
      contractError("The Astro compatibility response contains an unknown or duplicate component.");
    }
    seen.add(component);
    if (numberValue(item.maximum_points, `${component} maximum`) !== expectedMaximum) {
      contractError(`${component} has an unexpected maximum.`);
    }
    assertStringArray(item.rule_ids, `${component} rule IDs`);
    const status = stringValue(item.status, `${component} status`);
    if (status === "evaluated") {
      const points = numberValue(item.achieved_points, `${component} achieved points`);
      if (points < 0 || points > expectedMaximum || item.abstention_reason !== null) {
        contractError(`${component} has invalid evaluated points.`);
      }
      achievedTotal += points;
      evaluatedMaximum += expectedMaximum;
    } else if (status === "abstained") {
      if (item.achieved_points !== null || typeof item.abstention_reason !== "string") {
        contractError(`${component} has an invalid abstention.`);
      }
    } else {
      contractError(`${component} has an unsupported status.`);
    }
  }
  if (seen.size !== COMPONENT_MAXIMUMS.size || evaluatedMaximum !== expectedEvaluatedMaximum) {
    contractError("The Astro compatibility response has unexpected component coverage.");
  }
  return achievedTotal;
}

function assertManglikFactors(value: unknown, label: string): void {
  const factors = arrayValue(value, label);
  if (factors.length !== 3) contractError(`${label} must contain exactly three factors.`);
  const references = new Set<string>();
  for (const [index, rawFactor] of factors.entries()) {
    const factor = objectValue(rawFactor, `${label} factor ${index + 1}`);
    const reference = stringValue(factor.reference_point, `${label} reference point`);
    if (!MANGLIK_REFERENCES.has(reference) || references.has(reference)) {
      contractError(`${label} contains an unknown or duplicate reference point.`);
    }
    references.add(reference);
    const house = numberValue(factor.mars_house, `${label} Mars house`);
    if (!Number.isInteger(house) || house < 1 || house > 12) {
      contractError(`${label} contains an invalid Mars house.`);
    }
    booleanValue(factor.flagged, `${label} flagged value`);
    assertStringArray(factor.rule_ids, `${label} rule IDs`);
  }
}

export function assertCompatibilityFactsContract(
  payload: unknown,
  expectComplete: boolean,
): asserts payload is Record<string, unknown> {
  const facts = objectValue(payload, "Astro compatibility response");
  if (facts.facts_version !== COMPATIBILITY_FACTS_VERSION) {
    contractError("The Astro compatibility facts version is not supported.");
  }
  if (facts.compatibility_profile !== COMPATIBILITY_PROFILE) {
    contractError("The Astro compatibility profile is not supported.");
  }
  if (facts.calculation_profile !== COMPATIBILITY_CALCULATION_PROFILE) {
    contractError("The Astro compatibility calculation profile is not supported.");
  }
  assertFingerprint(facts.subject_fingerprint, "Subject fingerprint");
  assertFingerprint(facts.partner_fingerprint, "Partner fingerprint");
  assertFingerprint(facts.pair_fingerprint, "Pair fingerprint");

  const expectedEvaluatedMaximum = expectComplete ? 36 : 27;
  const achievedTotal = assertComponents(
    facts.ashtakoota_components,
    expectedEvaluatedMaximum,
  );
  if (numberValue(facts.total_maximum_points, "Total maximum points") !== 36) {
    contractError("The Astro compatibility total maximum must be 36.");
  }
  if (
    numberValue(facts.evaluated_maximum_points, "Evaluated maximum points") !==
      expectedEvaluatedMaximum
  ) {
    contractError("The Astro compatibility evaluated maximum is inconsistent.");
  }
  if (booleanValue(facts.complete_36_point_evaluation, "Completeness") !== expectComplete) {
    contractError("The Astro compatibility completeness flag is inconsistent.");
  }
  if (Math.abs(numberValue(facts.total_achieved_points, "Total achieved points") - achievedTotal) > 1e-6) {
    contractError("The Astro compatibility total does not match the component facts.");
  }
  assertManglikFactors(facts.subject_manglik_factors, "Subject Manglik factors");
  assertManglikFactors(facts.partner_manglik_factors, "Partner Manglik factors");
  assertStringArray(facts.rule_ids, "Compatibility rule IDs");
  objectValue(facts.metadata, "Compatibility metadata");
}
