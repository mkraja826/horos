import type {
  CompatibilityPartnerBirth,
  TraditionalCompatibilityRole,
} from "@/types/models";

export type CompatibilityRequest = {
  partnerBirth?: CompatibilityPartnerBirth;
  savedPartnerId?: string;
  subjectRole: TraditionalCompatibilityRole;
  partnerRole: TraditionalCompatibilityRole;
};

export type SavedCompatibilityPartner = {
  id: string;
  label: string;
  dateOfBirth: string;
  timezone: string;
  createdAt: string;
};

export type SaveCompatibilityPartnerRequest = {
  label: string;
  consentToSave: true;
  partnerBirth: CompatibilityPartnerBirth;
};
