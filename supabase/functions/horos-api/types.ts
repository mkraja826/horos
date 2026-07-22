export type Language = "English" | "Hindi" | "Telugu";
export type CalculationMode = "provider" | "editorial";
export type Period = "daily" | "weekly" | "monthly";

export type ProfileInput = {
  fullName: string;
  gender?: string;
  language: Language;
  notificationTime: string;
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  currentCity?: string;
  timezone: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
};

export type ProfileRow = {
  user_id: string;
  full_name: string;
  gender: string | null;
  preferred_language: Language;
  current_city: string | null;
  notification_time: string;
  notifications_enabled: boolean;
};

export type BirthDetailsRow = {
  user_id: string;
  date_of_birth: string;
  time_of_birth: string;
  birth_place: string;
  timezone: string;
  latitude: number;
  longitude: number;
  altitude_meters: number;
  rashi: string | null;
  nakshatra: string | null;
  lagna: string | null;
  chart_json: Record<string, unknown> | null;
  calculation_profile: string;
  calculation_mode: "provider" | "estimated";
};

export type SubscriptionRow = {
  user_id: string;
  platform: "android" | "ios" | null;
  product_id: string | null;
  provider_customer_id: string | null;
  status: "trial" | "active" | "expired" | "cancelled";
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
};

export type ChartResult = {
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
  planetaryPositions: Record<string, number>;
  calculationMode: "provider";
  calculationProfile: string;
  ayanamshaDegrees: number;
  provider: {
    engine: string;
    astronomicalProvider: string;
    ephemerisModel?: string | null;
    requestId?: string;
  };
  rawPositions: unknown;
};

export type AstroPosition = {
  body: string;
  longitude: number;
  sign_index: number;
  sign: string;
  nakshatra: string;
  pada: number;
};

export type AstroPositionsResponse = {
  calculation_profile: string;
  ayanamsha_degrees: number;
  ascendant: {
    longitude: number;
    sign_index: number;
    sign: string;
    nakshatra: string;
    pada: number;
  };
  planets: AstroPosition[];
  metadata: {
    engine: string;
    astronomical_provider: string;
    ephemeris_model?: string | null;
  };
};

export type AstroPanchangaResponse = {
  local_date: string;
  timezone: string;
  solar_times: {
    sunrise_local: string;
    sunset_local: string;
    method: string;
  };
  vara: { name: string };
  tithi: { name: string; paksha: string };
  nakshatra: { name: string; pada: number };
  yoga: { name: string };
  karana: { name: string };
  calculation_profile: string;
  ayanamsha_degrees: number;
  metadata: {
    engine: string;
    astronomical_provider: string;
    ephemeris_model?: string | null;
  };
};
