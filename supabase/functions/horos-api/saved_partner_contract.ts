import {
  type CompatibilityBirthInput,
  parseCompatibilityBirthInput,
  rejectUnknownFields,
  stringValue,
} from "./compatibility.ts";
import { ResponseError } from "./errors.ts";

const CREATE_FIELDS = new Set(["label", "consentToSave", "partnerBirth"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SavedPartnerCreateInput = {
  label: string;
  partnerBirth: CompatibilityBirthInput;
};

export function parseSavedPartnerCreate(body: Record<string, unknown>): SavedPartnerCreateInput {
  rejectUnknownFields(body, CREATE_FIELDS, "Saved partner request");
  if (body.consentToSave !== true) {
    throw new ResponseError(
      "Explicit consent is required before partner birth details can be saved.",
      400,
      "SAVED_PARTNER_CONSENT_REQUIRED",
    );
  }
  return {
    label: stringValue(body.label, "Partner label", 60),
    partnerBirth: parseCompatibilityBirthInput(body.partnerBirth),
  };
}

export function parseSavedPartnerId(value: string): string {
  const normalized = stringValue(value, "Saved partner ID", 36);
  if (!UUID_PATTERN.test(normalized)) {
    throw new ResponseError("Saved partner ID is invalid.", 400, "INVALID_SAVED_PARTNER_ID");
  }
  return normalized;
}
