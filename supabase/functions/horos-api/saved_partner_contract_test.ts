import { parseCompatibilityRequest } from "./compatibility.ts";
import { ResponseError } from "./errors.ts";
import {
  parseSavedPartnerCreate,
  parseSavedPartnerId,
} from "./saved_partner_contract.ts";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

function birth() {
  return {
    dateOfBirth: "1999-05-14",
    timeOfBirth: "08:15",
    timezone: "Asia/Kolkata",
    latitude: 17.385,
    longitude: 78.487,
    altitudeMeters: 500,
  };
}

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectCode(callback: () => unknown, code: string) {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof ResponseError)) throw error;
    assertEquals(error.code, code, "error code");
    return;
  }
  throw new Error(`Expected ${code}.`);
}

Deno.test("Saved partner creation requires explicit true consent", () => {
  expectCode(
    () => parseSavedPartnerCreate({ label: "Partner A", partnerBirth: birth() }),
    "SAVED_PARTNER_CONSENT_REQUIRED",
  );
  expectCode(
    () =>
      parseSavedPartnerCreate({
        label: "Partner A",
        consentToSave: false,
        partnerBirth: birth(),
      }),
    "SAVED_PARTNER_CONSENT_REQUIRED",
  );

  const parsed = parseSavedPartnerCreate({
    label: " Partner A ",
    consentToSave: true,
    partnerBirth: birth(),
  });
  assertEquals(parsed.label, "Partner A", "trimmed label");
  assertEquals(parsed.partnerBirth.timeOfBirth, "08:15:00", "normalized birth time");
});

Deno.test("Saved partner creation rejects unknown fields and invalid labels", () => {
  expectCode(
    () =>
      parseSavedPartnerCreate({
        label: "Partner A",
        consentToSave: true,
        partnerBirth: birth(),
        fullName: "Must not be accepted",
      }),
    "INVALID_COMPATIBILITY_REQUEST",
  );
  expectCode(
    () =>
      parseSavedPartnerCreate({
        label: "",
        consentToSave: true,
        partnerBirth: birth(),
      }),
    "INVALID_COMPATIBILITY_REQUEST",
  );
});

Deno.test("Saved partner IDs are strict UUIDs", () => {
  assertEquals(parseSavedPartnerId(VALID_ID), VALID_ID, "valid saved partner ID");
  expectCode(() => parseSavedPartnerId("not-an-id"), "INVALID_SAVED_PARTNER_ID");
});

Deno.test("Compatibility request accepts exactly one direct or saved selection", () => {
  const saved = parseCompatibilityRequest({ savedPartnerId: VALID_ID });
  assertEquals(saved.savedPartnerId, VALID_ID, "saved partner ID");
  assertEquals(saved.partnerBirth, null, "saved selection direct birth");

  const direct = parseCompatibilityRequest({ partnerBirth: birth() });
  assertEquals(direct.savedPartnerId, null, "direct selection saved ID");
  if (!direct.partnerBirth) throw new Error("Direct birth was not parsed.");
  assertEquals(direct.partnerBirth.dateOfBirth, "1999-05-14", "direct birth date");

  expectCode(() => parseCompatibilityRequest({}), "INVALID_COMPATIBILITY_SELECTION");
  expectCode(
    () => parseCompatibilityRequest({ partnerBirth: birth(), savedPartnerId: VALID_ID }),
    "INVALID_COMPATIBILITY_SELECTION",
  );
  expectCode(
    () => parseCompatibilityRequest({ savedPartnerId: "not-an-id" }),
    "INVALID_SAVED_PARTNER_ID",
  );
});
