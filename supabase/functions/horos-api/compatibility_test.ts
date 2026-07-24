import { AstroProviderError } from "./astro.ts";
import {
  isPhase4CompatibilityEnabled,
  parseCompatibilityRequest,
} from "./compatibility.ts";
import { assertCompatibilityFactsContract } from "./compatibility_contract.ts";
import { buildCompatibilityProviderBody } from "./compatibility_provider.ts";
import { ResponseError } from "./db.ts";
import type { BirthDetailsRow } from "./types.ts";

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectResponseError(
  callback: () => unknown,
  expectedCode: string,
): void {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof ResponseError)) throw error;
    assertEquals(error.code, expectedCode, "response error code");
    return;
  }
  throw new Error(`Expected ResponseError ${expectedCode}.`);
}

function expectProviderContractError(callback: () => unknown): void {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof AstroProviderError)) throw error;
    assertEquals(
      error.providerCode,
      "COMPATIBILITY_CONTRACT_MISMATCH",
      "provider error code",
    );
    return;
  }
  throw new Error("Expected compatibility provider contract error.");
}

function requestBody() {
  return {
    partnerBirth: {
      dateOfBirth: "1999-05-14",
      timeOfBirth: "08:15",
      timezone: "Asia/Kolkata",
      latitude: 17.385,
      longitude: 78.487,
      altitudeMeters: 500,
    },
  };
}

function subjectBirth(): BirthDetailsRow {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    date_of_birth: "1998-10-26",
    time_of_birth: "10:28:00.000000",
    birth_place: "Macherla",
    timezone: "Asia/Kolkata",
    latitude: 16.575,
    longitude: 79.312,
    altitude_meters: 100,
    rashi: null,
    nakshatra: null,
    lagna: null,
    chart_json: null,
    calculation_profile: "south_indian_drik_lahiri_jpl_de440s_v1",
    calculation_mode: "provider",
  };
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

Deno.test("Phase 4 compatibility flag defaults closed", () => {
  assertEquals(isPhase4CompatibilityEnabled(undefined), false, "missing flag");
  assertEquals(isPhase4CompatibilityEnabled("false"), false, "false flag");
  assertEquals(isPhase4CompatibilityEnabled(" TRUE "), true, "normalized true flag");
});

Deno.test("Compatibility request accepts an ephemeral partner without names", () => {
  const parsed = parseCompatibilityRequest(requestBody());

  assertEquals(parsed.subjectRole, "unspecified", "subject role");
  assertEquals(parsed.partnerRole, "unspecified", "partner role");
  assertEquals(parsed.partnerBirth.timeOfBirth, "08:15:00", "normalized time");
  assertEquals(parsed.partnerBirth.altitudeMeters, 500, "altitude");
  assert(!("fullName" in parsed.partnerBirth), "partner names must not be accepted");
});

Deno.test("Compatibility request requires complete distinct traditional roles", () => {
  expectResponseError(
    () => parseCompatibilityRequest({ ...requestBody(), subjectRole: "bride" }),
    "INVALID_COMPATIBILITY_ROLES",
  );
  expectResponseError(
    () =>
      parseCompatibilityRequest({
        ...requestBody(),
        subjectRole: "bride",
        partnerRole: "bride",
      }),
    "INVALID_COMPATIBILITY_ROLES",
  );
  const parsed = parseCompatibilityRequest({
    ...requestBody(),
    subjectRole: "bride",
    partnerRole: "groom",
  });
  assertEquals(parsed.subjectRole, "bride", "valid subject role");
  assertEquals(parsed.partnerRole, "groom", "valid partner role");
});

Deno.test("Compatibility request rejects invalid dates and unknown fields", () => {
  expectResponseError(
    () =>
      parseCompatibilityRequest({
        ...requestBody(),
        partnerBirth: { ...requestBody().partnerBirth, dateOfBirth: "1999-02-30" },
      }),
    "INVALID_COMPATIBILITY_REQUEST",
  );
  expectResponseError(
    () => parseCompatibilityRequest({ ...requestBody(), partnerName: "Not accepted" }),
    "INVALID_COMPATIBILITY_REQUEST",
  );
});

Deno.test("Compatibility provider body uses stored user birth and no identity fields", () => {
  const request = parseCompatibilityRequest({
    ...requestBody(),
    subjectRole: "bride",
    partnerRole: "groom",
  });
  const body = buildCompatibilityProviderBody(subjectBirth(), request);
  const subject = body.subject_birth as Record<string, unknown>;
  const partner = body.partner_birth as Record<string, unknown>;

  assertEquals(subject.local_datetime, "1998-10-26T10:28:00", "subject datetime");
  assertEquals(partner.local_datetime, "1999-05-14T08:15:00", "partner datetime");
  assertEquals(body.subject_role, "bride", "provider subject role");
  assertEquals(body.partner_role, "groom", "provider partner role");
  const serialized = JSON.stringify(body);
  assert(!serialized.includes("Macherla"), "birth-place labels must not be forwarded");
  assert(!serialized.includes("full_name"), "profile names must not be forwarded");
});

Deno.test("Compatibility facts contract accepts role-neutral 27-point coverage", () => {
  assertCompatibilityFactsContract(factsPayload(false), false);
});

Deno.test("Compatibility facts contract accepts role-aware 36-point coverage", () => {
  assertCompatibilityFactsContract(factsPayload(true), true);
});

Deno.test("Compatibility facts contract rejects false totals and coverage", () => {
  const badTotal = factsPayload(true);
  badTotal.total_achieved_points += 1;
  expectProviderContractError(() => assertCompatibilityFactsContract(badTotal, true));

  const wrongCoverage = factsPayload(false);
  wrongCoverage.evaluated_maximum_points = 36;
  expectProviderContractError(() => assertCompatibilityFactsContract(wrongCoverage, false));
});

Deno.test("Compatibility facts contract rejects missing Manglik references", () => {
  const invalid = factsPayload(true);
  invalid.subject_manglik_factors[2] = manglik("moon", true);
  expectProviderContractError(() => assertCompatibilityFactsContract(invalid, true));
});
