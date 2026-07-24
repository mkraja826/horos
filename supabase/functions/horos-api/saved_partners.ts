import {
  type CompatibilityBirthInput,
  type CompatibilityRequestInput,
  type CompatibilityRequestSelection,
  objectValue,
  parseCompatibilityBirthInput,
  rejectUnknownFields,
  stringValue,
} from "./compatibility.ts";
import { adminClient, ResponseError } from "./db.ts";

const CREATE_FIELDS = new Set(["label", "consentToSave", "partnerBirth"]);
const MAX_SAVED_PARTNERS = 10;

type SavedPartnerRow = {
  id: string;
  user_id: string;
  label: string;
  date_of_birth: string;
  time_of_birth: string;
  timezone: string;
  latitude: number;
  longitude: number;
  altitude_meters: number | null;
  consent_recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type SavedPartnerListItem = {
  id: string;
  label: string;
  dateOfBirth: string;
  timezone: string;
  createdAt: string;
};

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

function listItem(row: Pick<SavedPartnerRow, "id" | "label" | "date_of_birth" | "timezone" | "created_at">): SavedPartnerListItem {
  return {
    id: row.id,
    label: row.label,
    dateOfBirth: row.date_of_birth,
    timezone: row.timezone,
    createdAt: row.created_at,
  };
}

function birthFromRow(row: SavedPartnerRow): CompatibilityBirthInput {
  return {
    dateOfBirth: row.date_of_birth,
    timeOfBirth: row.time_of_birth.slice(0, 8),
    timezone: row.timezone,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitude_meters ?? 0,
  };
}

export async function listSavedPartners(userId: string): Promise<{ partners: SavedPartnerListItem[] }> {
  const result = await adminClient
    .from("saved_compatibility_partners")
    .select("id,label,date_of_birth,timezone,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  return {
    partners: ((result.data ?? []) as Array<Pick<
      SavedPartnerRow,
      "id" | "label" | "date_of_birth" | "timezone" | "created_at"
    >>).map(listItem),
  };
}

export async function createSavedPartner(
  userId: string,
  body: Record<string, unknown>,
): Promise<{ partner: SavedPartnerListItem }> {
  const input = parseSavedPartnerCreate(body);
  const countResult = await adminClient
    .from("saved_compatibility_partners")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countResult.error) throw countResult.error;
  if ((countResult.count ?? 0) >= MAX_SAVED_PARTNERS) {
    throw new ResponseError(
      `You can save up to ${MAX_SAVED_PARTNERS} partner profiles. Delete one before saving another.`,
      409,
      "SAVED_PARTNER_LIMIT_REACHED",
    );
  }

  const birth = input.partnerBirth;
  const inserted = await adminClient
    .from("saved_compatibility_partners")
    .insert({
      user_id: userId,
      label: input.label,
      date_of_birth: birth.dateOfBirth,
      time_of_birth: birth.timeOfBirth,
      timezone: birth.timezone,
      latitude: birth.latitude,
      longitude: birth.longitude,
      altitude_meters: birth.altitudeMeters,
      consent_recorded_at: new Date().toISOString(),
    })
    .select("id,label,date_of_birth,timezone,created_at")
    .single();
  if (inserted.error) throw inserted.error;
  return { partner: listItem(inserted.data as SavedPartnerRow) };
}

export async function deleteSavedPartner(
  userId: string,
  partnerId: string,
): Promise<{ deleted: true }> {
  const normalized = stringValue(partnerId, "Saved partner ID", 36);
  const result = await adminClient
    .from("saved_compatibility_partners")
    .delete()
    .eq("id", normalized)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw new ResponseError("Saved partner profile was not found.", 404, "SAVED_PARTNER_NOT_FOUND");
  }
  return { deleted: true };
}

export async function resolveCompatibilitySelection(
  userId: string,
  selection: CompatibilityRequestSelection,
): Promise<CompatibilityRequestInput> {
  if (selection.partnerBirth) {
    return {
      partnerBirth: selection.partnerBirth,
      subjectRole: selection.subjectRole,
      partnerRole: selection.partnerRole,
    };
  }

  const savedPartnerId = selection.savedPartnerId;
  if (!savedPartnerId) {
    throw new ResponseError(
      "A partner birth selection is required.",
      400,
      "INVALID_COMPATIBILITY_SELECTION",
    );
  }
  const result = await adminClient
    .from("saved_compatibility_partners")
    .select(
      "id,user_id,label,date_of_birth,time_of_birth,timezone,latitude,longitude,altitude_meters,consent_recorded_at,created_at,updated_at",
    )
    .eq("id", savedPartnerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw new ResponseError("Saved partner profile was not found.", 404, "SAVED_PARTNER_NOT_FOUND");
  }
  const row = objectValue(result.data, "Saved partner profile") as unknown as SavedPartnerRow;
  return {
    partnerBirth: birthFromRow(row),
    subjectRole: selection.subjectRole,
    partnerRole: selection.partnerRole,
  };
}
