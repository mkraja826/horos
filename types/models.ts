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

export type HoroscopeReading = {
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
  calculationMode: "provider" | "estimated";
};

export type Panchang = {
  date: string;
  location: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  rahuKalam: string;
  yamagandam: string;
  gulikaKalam: string;
  auspiciousPeriod: string;
  importantDay?: string;
  calculationMode: "provider" | "estimated";
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
  calculationMode: "provider" | "estimated";
};
