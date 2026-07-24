export type Language = "English" | "Hindi" | "Telugu";
export type Gender = "Female" | "Male" | "Prefer not to say";

export type BirthDetails = {
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  currentCity?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
};

export type UserProfile = {
  id: string;
  fullName: string;
  identifier: string;
  gender?: Gender;
  language: Language;
  notificationTime: string;
  notificationsEnabled: boolean;
  birth: BirthDetails;
  rashi: string;
  nakshatra: string;
  lagna: string;
  calculationProfile?: string;
  calculationMode?: "provider" | "estimated";
};

export type SubscriptionState = {
  access: "trial" | "active" | "limited";
  status: "trial" | "active" | "expired" | "cancelled";
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  daysRemaining: number;
  isPremium: boolean;
};

export type ReadingSection = {
  key: string;
  title: string;
  icon: string;
  content: string;
  premium?: boolean;
};

export type EditorialHoroscopeReading = {
  period: "daily" | "weekly" | "monthly";
  label: string;
  summary: string;
  focus: string;
  luckyColor?: string;
  luckyColorHex?: string;
  luckyNumber?: number;
  mantra?: string;
  remedy: string;
  auspiciousTime?: string;
  cautionTime?: string;
  sections: ReadingSection[];
  generatedAt: string;
  calculationMode: "provider" | "estimated" | "editorial";
};

export type PredictionEvidence = {
  evidence_id: string;
  domain: string;
  statement: string;
  polarity: "supporting" | "challenging" | "contextual";
  weight: number;
  source_rule_ids: string[];
  source_kind: "classical" | "convention" | string;
  reason: string;
};

export type PredictionDomainResult = {
  domain: string;
  outlook: "favourable" | "mixed" | "challenging" | "insufficient" | "insufficient_evidence";
  strength: string;
  supporting_score: number;
  challenging_score: number;
  net_score: number;
  statement: string;
  advisory: string;
  favourable_timing: string | null;
  challenging_timing: string | null;
  supporting_factors: PredictionEvidence[];
  challenging_factors: PredictionEvidence[];
  contextual_factors: PredictionEvidence[];
};

export type ProviderHoroscopeReading = {
  engine_version: string;
  calculation_profile: string;
  classical_profile: string;
  period: "daily" | "weekly" | "monthly";
  as_of: string;
  results: PredictionDomainResult[];
  disclaimer: string;
  generatedAt: string;
  calculationMode: "provider";
  provider: { requestId: string };
};

export type HoroscopeReading = EditorialHoroscopeReading | ProviderHoroscopeReading;

export type Panchang = {
  date: string;
  location: string;
  vara?: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  rahuKalam?: string;
  yamagandam?: string;
  gulikaKalam?: string;
  auspiciousPeriod?: string;
  importantDay?: string;
  calculationMode: "provider" | "estimated";
  calculationProfile?: string;
  ayanamshaDegrees?: number;
  solarMethod?: string;
  provider?: {
    engine: string;
    astronomicalProvider: string;
    ephemerisModel?: string | null;
  };
};

export type BirthChart = {
  rashi: string;
  nakshatra: string;
  lagna: string;
  birthStar: string;
  element: string;
  nature: string;
  strengths: string[];
  challenges: string[];
  lifestyleBalance: string;
  dasha?: string;
  planetaryPositions?: Record<string, number>;
  calculationMode: "provider" | "estimated";
  calculationProfile?: string;
  ayanamshaDegrees?: number;
  provider?: {
    engine: string;
    astronomicalProvider: string;
    ephemerisModel?: string | null;
  };
};

export type TraditionalCompatibilityRole = "unspecified" | "bride" | "groom";

export type CompatibilityPartnerBirth = {
  dateOfBirth: string;
  timeOfBirth: string;
  timezone: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
};

export type CompatibilityRequest = {
  partnerBirth: CompatibilityPartnerBirth;
  subjectRole: TraditionalCompatibilityRole;
  partnerRole: TraditionalCompatibilityRole;
};

export type CompatibilityComponentName =
  | "varna"
  | "vashya"
  | "tara"
  | "yoni"
  | "graha_maitri"
  | "gana"
  | "bhakoot"
  | "nadi";

export type CompatibilityComponentFact = {
  component: CompatibilityComponentName;
  status: "evaluated" | "abstained";
  achieved_points: number | null;
  maximum_points: number;
  rule_ids: string[];
  abstention_reason: string | null;
};

export type ManglikFactor = {
  reference_point: "lagna" | "moon" | "venus";
  mars_house: number;
  flagged: boolean;
  rule_ids: string[];
};

export type CompatibilityFacts = {
  facts_version: "compatibility_facts_v2";
  compatibility_profile: "ashtakoota_v2";
  calculation_profile: string;
  subject_fingerprint: string;
  partner_fingerprint: string;
  pair_fingerprint: string;
  ashtakoota_components: CompatibilityComponentFact[];
  total_achieved_points: number;
  evaluated_maximum_points: 27 | 36;
  total_maximum_points: 36;
  complete_36_point_evaluation: boolean;
  subject_manglik_factors: ManglikFactor[];
  partner_manglik_factors: ManglikFactor[];
  rule_ids: string[];
  metadata: Record<string, unknown>;
};

export type CompatibilityBand = "insufficient" | "challenging" | "mixed" | "supportive";

export type CompatibilityComponentInterpretation = {
  component: CompatibilityComponentName;
  status: "evaluated" | "abstained";
  achieved_points: number | null;
  maximum_points: number;
  ratio: number | null;
  band: CompatibilityBand;
  headline: string;
  explanation: string;
  evidence_refs: string[];
};

export type PartnershipOutlookIndex = {
  domain: "partnership";
  score: number | null;
  band: "very_challenging" | "challenging" | "mixed" | "supportive" | "very_supportive" | null;
  score_version: "outlook_index_v1";
  confidence_status: "insufficient" | "uncalibrated_low" | "uncalibrated_moderate";
  supporting_component: number;
  challenging_component: number;
  coverage: number;
  conflict_status: "none" | "internal_conflict" | "cross_channel_conflict" | "insufficient";
  evidence_refs: string[];
  disclaimer: string;
};

export type CompatibilityManglikContext = {
  subject_flagged_count: number;
  partner_flagged_count: number;
  comparison: string;
  evidence_refs: string[];
  disclaimer: string;
};

export type CompatibilityInterpretation = {
  interpretation_version: "compatibility_interpretation_v1";
  facts_version: "compatibility_facts_v2";
  evaluated_maximum_points: 27 | 36;
  complete_36_point_evaluation: boolean;
  partnership_index: PartnershipOutlookIndex;
  components: CompatibilityComponentInterpretation[];
  strengths: string[];
  cautions: string[];
  manglik_context: CompatibilityManglikContext;
  disclaimer: string;
};

export type CompatibilityReport = {
  facts: CompatibilityFacts;
  interpretation: CompatibilityInterpretation;
  generatedAt: string;
  calculationMode: "provider";
  provider: { requestId: string };
};
