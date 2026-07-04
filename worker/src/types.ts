export type Bindings = {
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "production";
  ALLOWED_ORIGINS?: string;
  JWT_SECRET: string;
  OTP_PROVIDER_URL?: string;
  OTP_PROVIDER_TOKEN?: string;
  ASTROLOGY_PROVIDER_URL?: string;
  ASTROLOGY_PROVIDER_KEY?: string;
  REVENUECAT_SECRET_KEY?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
  REVENUECAT_ENTITLEMENT_ID?: string;
};

export type Variables = {
  userId: string;
};

export type ProfileRow = {
  id: string;
  identifier: string;
  full_name: string;
  gender: string | null;
  preferred_language: string;
  current_city: string | null;
  notification_time: string;
  notifications_enabled: number;
  date_of_birth: string;
  time_of_birth: string;
  birth_place: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  rashi: string;
  nakshatra: string;
  lagna: string;
  calculation_mode: "provider" | "estimated";
};

export type SubscriptionRow = {
  user_id: string;
  platform: "android" | "ios" | null;
  product_id: string | null;
  purchase_token: string | null;
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
  planetaryPositions?: Record<string, number>;
  transitScore?: number;
  calculationMode: "provider" | "estimated";
};
