import { getSecureValue } from "@/lib/secure-storage";
import type { BirthChart, HoroscopeReading, Panchang, SubscriptionState, UserProfile } from "@/types/models";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
export const isApiConfigured = Boolean(configuredUrl);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "API_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & { authenticated?: boolean };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!configuredUrl) throw new ApiError("The API URL is not configured.", 0, "API_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const token = options.authenticated === false ? null : await getSecureValue("session-token");

  try {
    const response = await fetch(`${configuredUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; code?: string }
      | T
      | null;

    if (!response.ok) {
      const errorBody = body as { error?: string; message?: string; code?: string } | null;
      throw new ApiError(
        errorBody?.message ?? errorBody?.error ?? "The request could not be completed.",
        response.status,
        errorBody?.code
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The request took too long. Please try again.", 0, "TIMEOUT");
    }
    throw new ApiError("Please check your internet connection and try again.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

export type OnboardingPayload = {
  fullName: string;
  gender?: string;
  language: string;
  notificationTime: string;
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  currentCity?: string;
  timezone: string;
};

export const api = {
  requestOtp: (identifier: string) =>
    request<{ requiresOtp: true; challengeId: string; devOtp?: string }>("/auth/login", {
      method: "POST",
      authenticated: false,
      body: JSON.stringify({ identifier })
    }),

  verifyOtp: (identifier: string, challengeId: string, otp: string) =>
    request<{ token: string; profile: UserProfile | null }>("/auth/login", {
      method: "POST",
      authenticated: false,
      body: JSON.stringify({ identifier, challengeId, otp })
    }),

  getProfile: () => request<{ profile: UserProfile }>("/profile/me"),
  createProfile: (payload: OnboardingPayload) =>
    request<{ profile: UserProfile; subscription: SubscriptionState }>("/profile/create", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateProfile: (payload: Partial<OnboardingPayload>) =>
    request<{ profile: UserProfile }>("/profile/update", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteAccount: () => request<{ deleted: true }>("/profile/me", { method: "DELETE" }),

  daily: () => request<HoroscopeReading>("/horoscope/daily"),
  weekly: () => request<HoroscopeReading>("/horoscope/weekly"),
  monthly: () => request<HoroscopeReading>("/horoscope/monthly"),
  birthChart: () => request<BirthChart>("/birth-chart"),
  panchang: () => request<Panchang>("/panchang/today"),

  subscriptionStatus: () => request<SubscriptionState>("/subscription/status"),
  verifySubscription: (platform: "android" | "ios", productId: string) =>
    request<SubscriptionState>("/subscription/verify", {
      method: "POST",
      body: JSON.stringify({ platform, productId })
    }),

  registerNotification: (pushToken: string, notificationTime: string) =>
    request<{ registered: true }>("/notifications/register", {
      method: "POST",
      body: JSON.stringify({ pushToken, notificationTime })
    })
};
