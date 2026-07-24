import { ResponseError } from "./errors.ts";

export type TraditionalCompatibilityRole = "unspecified" | "bride" | "groom";

export type CompatibilityBirthInput = {
  dateOfBirth: string;
  timeOfBirth: string;
  timezone: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
};

export type CompatibilityRequestSelection = {
  partnerBirth: CompatibilityBirthInput | null;
  savedPartnerId: string | null;
  subjectRole: TraditionalCompatibilityRole;
  partnerRole: TraditionalCompatibilityRole;
};

export type CompatibilityRequestInput = {
  partnerBirth: CompatibilityBirthInput;
  subjectRole: TraditionalCompatibilityRole;
  partnerRole: TraditionalCompatibilityRole;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_BODY_FIELDS = new Set([
  "partnerBirth",
  "savedPartnerId",
  "subjectRole",
  "partnerRole",
]);
const ALLOWED_BIRTH_FIELDS = new Set([
  "dateOfBirth",
  "timeOfBirth",
  "timezone",
  "latitude",
  "longitude",
  "altitudeMeters",
]);

export function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResponseError(`${label} is required.`, 400, "INVALID_COMPATIBILITY_REQUEST");
  }
  return value as Record<string, unknown>;
}

export function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ResponseError(
      `${label} contains unsupported fields.`,
      400,
      "INVALID_COMPATIBILITY_REQUEST",
    );
  }
}

export function stringValue(value: unknown, label: string, maxLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new ResponseError(`${label} is invalid.`, 400, "INVALID_COMPATIBILITY_REQUEST");
  }
  return normalized;
}

function numberValue(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ResponseError(`${label} is invalid.`, 400, "INVALID_COMPATIBILITY_REQUEST");
  }
  return value;
}

function validCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function normalizeTime(value: string): string {
  if (!TIME_PATTERN.test(value)) {
    throw new ResponseError(
      "Partner birth time is invalid.",
      400,
      "INVALID_COMPATIBILITY_REQUEST",
    );
  }
  const [hours, minutes, seconds = "00"] = value.split(":");
  return `${hours}:${minutes}:${seconds.split(".")[0]}`;
}

function roleValue(value: unknown, label: string): TraditionalCompatibilityRole {
  if (value === undefined || value === null || value === "") return "unspecified";
  if (value === "unspecified" || value === "bride" || value === "groom") return value;
  throw new ResponseError(`${label} is invalid.`, 400, "INVALID_COMPATIBILITY_ROLES");
}

export function parseCompatibilityBirthInput(value: unknown): CompatibilityBirthInput {
  const birth = objectValue(value, "Partner birth details");
  rejectUnknownFields(birth, ALLOWED_BIRTH_FIELDS, "Partner birth details");
  const dateOfBirth = stringValue(birth.dateOfBirth, "Partner birth date", 10);
  if (!validCalendarDate(dateOfBirth)) {
    throw new ResponseError(
      "Partner birth date is invalid.",
      400,
      "INVALID_COMPATIBILITY_REQUEST",
    );
  }
  return {
    dateOfBirth,
    timeOfBirth: normalizeTime(stringValue(birth.timeOfBirth, "Partner birth time", 20)),
    timezone: stringValue(birth.timezone, "Partner timezone", 64),
    latitude: numberValue(birth.latitude, "Partner latitude", -90, 90),
    longitude: numberValue(birth.longitude, "Partner longitude", -180, 180),
    altitudeMeters: birth.altitudeMeters === undefined
      ? 0
      : numberValue(birth.altitudeMeters, "Partner altitude", -500, 10_000),
  };
}

function validateRoles(
  subjectRole: TraditionalCompatibilityRole,
  partnerRole: TraditionalCompatibilityRole,
): void {
  const subjectUnspecified = subjectRole === "unspecified";
  const partnerUnspecified = partnerRole === "unspecified";
  if (subjectUnspecified !== partnerUnspecified) {
    throw new ResponseError(
      "Traditional roles must be supplied for both people or neither.",
      400,
      "INVALID_COMPATIBILITY_ROLES",
    );
  }
  if (!subjectUnspecified && subjectRole === partnerRole) {
    throw new ResponseError(
      "Traditional roles must include one bride and one groom.",
      400,
      "INVALID_COMPATIBILITY_ROLES",
    );
  }
}

export function parseCompatibilityRequest(
  body: Record<string, unknown>,
): CompatibilityRequestSelection {
  rejectUnknownFields(body, ALLOWED_BODY_FIELDS, "Compatibility request");
  const hasDirectBirth = body.partnerBirth !== undefined && body.partnerBirth !== null;
  const hasSavedPartner = body.savedPartnerId !== undefined && body.savedPartnerId !== null &&
    body.savedPartnerId !== "";
  if (hasDirectBirth === hasSavedPartner) {
    throw new ResponseError(
      "Choose exactly one direct partner birth or saved partner profile.",
      400,
      "INVALID_COMPATIBILITY_SELECTION",
    );
  }

  const subjectRole = roleValue(body.subjectRole, "Subject role");
  const partnerRole = roleValue(body.partnerRole, "Partner role");
  validateRoles(subjectRole, partnerRole);

  let savedPartnerId: string | null = null;
  if (hasSavedPartner) {
    savedPartnerId = stringValue(body.savedPartnerId, "Saved partner ID", 36);
    if (!UUID_PATTERN.test(savedPartnerId)) {
      throw new ResponseError(
        "Saved partner ID is invalid.",
        400,
        "INVALID_SAVED_PARTNER_ID",
      );
    }
  }

  return {
    partnerBirth: hasDirectBirth ? parseCompatibilityBirthInput(body.partnerBirth) : null,
    savedPartnerId,
    subjectRole,
    partnerRole,
  };
}

export function isPhase4CompatibilityEnabled(
  value = Deno.env.get("PHASE4_COMPATIBILITY_ENABLED"),
): boolean {
  return value?.trim().toLowerCase() === "true";
}
