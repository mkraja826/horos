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
