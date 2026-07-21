import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

import {
  api,
  isApiConfigured,
  REFRESH_SESSION_KEY,
  SESSION_KEY,
  type OnboardingPayload,
} from "@/lib/api-client";
import { demoProfile } from "@/lib/fixtures";
import {
  deleteSecureValue,
  getSecureJson,
  getSecureValue,
  setSecureJson,
  setSecureValue,
} from "@/lib/secure-storage";
import type { Gender, Language, SubscriptionState, UserProfile } from "@/types/models";

const PROFILE_KEY = "private-user-profile";
const SUBSCRIPTION_KEY = "subscription-state";

export type OnboardingInput = {
  fullName: string;
  gender?: Gender;
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

type LoginRequest = { challengeId: string; devOtp?: string };

type AppContextValue = {
  booting: boolean;
  isAuthenticated: boolean;
  isApiConfigured: boolean;
  profile: UserProfile | null;
  subscription: SubscriptionState;
  requestOtp: (identifier: string) => Promise<LoginRequest>;
  verifyOtp: (identifier: string, challengeId: string, otp: string) => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateProfile: (input: Partial<OnboardingInput> & Partial<UserProfile>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  activateLocalTrial: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const limitedSubscription: SubscriptionState = {
  access: "limited",
  status: "expired",
  daysRemaining: 0,
  isPremium: false,
};

const AppContext = createContext<AppContextValue | null>(null);

function newTrial(): SubscriptionState {
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    access: "trial",
    status: "trial",
    trialEndsAt,
    daysRemaining: 30,
    isPremium: true,
  };
}

function localProfile(input: OnboardingInput, identifier: string): UserProfile {
  const rashis = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"];
  const nakshatras = ["Ashwini", "Rohini", "Mrigashira", "Pushya", "Magha", "Hasta", "Swati", "Anuradha", "Mula", "Shravana", "Shatabhisha", "Revati"];
  const seed = input.dateOfBirth.split("").reduce((sum, value) => sum + (Number(value) || 0), 0);

  return {
    ...demoProfile,
    id: "local-user",
    fullName: input.fullName,
    identifier,
    gender: input.gender,
    language: input.language,
    notificationTime: input.notificationTime,
    birth: {
      dateOfBirth: input.dateOfBirth,
      timeOfBirth: input.timeOfBirth,
      birthPlace: input.birthPlace,
      currentCity: input.currentCity,
      timezone: input.timezone,
      latitude: input.latitude,
      longitude: input.longitude,
      altitudeMeters: input.altitudeMeters,
    },
    rashi: rashis[seed % rashis.length],
    nakshatra: nakshatras[seed % nakshatras.length],
    lagna: rashis[(seed + 4) % rashis.length],
    calculationMode: "estimated",
  };
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState>(limitedSubscription);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getSecureValue(SESSION_KEY),
      getSecureJson<UserProfile>(PROFILE_KEY),
      getSecureJson<SubscriptionState>(SUBSCRIPTION_KEY),
    ]).then(async ([savedToken, savedProfile, savedSubscription]) => {
      if (!mounted) return;
      setToken(savedToken);
      setProfile(savedProfile);
      setIdentifier(savedProfile?.identifier ?? "");
      setSubscription(savedSubscription ?? limitedSubscription);

      if (savedToken && isApiConfigured) {
        try {
          const [{ profile: remoteProfile }, remoteSubscription] = await Promise.all([
            api.getProfile(),
            api.subscriptionStatus(),
          ]);
          if (!mounted) return;
          setToken(await getSecureValue(SESSION_KEY));
          setProfile(remoteProfile);
          setSubscription(remoteSubscription);
          await Promise.all([
            setSecureJson(PROFILE_KEY, remoteProfile),
            setSecureJson(SUBSCRIPTION_KEY, remoteSubscription),
          ]);
        } catch {
          // Keep the last encrypted profile for a calm offline startup.
        }
      }
      if (mounted) setBooting(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const requestOtp = useCallback(async (loginIdentifier: string) => {
    setIdentifier(loginIdentifier);
    if (!isApiConfigured) {
      return { challengeId: "local-challenge", devOtp: "123456" };
    }
    const response = await api.requestOtp(loginIdentifier);
    return { challengeId: response.challengeId };
  }, []);

  const verifyOtp = useCallback(async (loginIdentifier: string, challengeId: string, otp: string) => {
    if (!isApiConfigured) {
      if (otp !== "123456") throw new Error("Use 123456 for local preview login.");
      const localToken = `local.${Date.now()}`;
      await setSecureValue(SESSION_KEY, localToken);
      setToken(localToken);
      setIdentifier(loginIdentifier);
      return;
    }
    const response = await api.verifyOtp(loginIdentifier, challengeId, otp);
    await Promise.all([
      setSecureValue(SESSION_KEY, response.token),
      setSecureValue(REFRESH_SESSION_KEY, response.refreshToken),
    ]);
    setToken(response.token);
    setIdentifier(loginIdentifier);
    if (response.profile) {
      setProfile(response.profile);
      await setSecureJson(PROFILE_KEY, response.profile);
    }
  }, []);

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      if (isApiConfigured) {
        const payload: OnboardingPayload = { ...input };
        const response = await api.createProfile(payload);
        setProfile(response.profile);
        setSubscription(response.subscription);
        await Promise.all([
          setSecureJson(PROFILE_KEY, response.profile),
          setSecureJson(SUBSCRIPTION_KEY, response.subscription),
        ]);
        return;
      }

      const nextProfile = localProfile(input, identifier);
      const trial = newTrial();
      setProfile(nextProfile);
      setSubscription(trial);
      await Promise.all([
        setSecureJson(PROFILE_KEY, nextProfile),
        setSecureJson(SUBSCRIPTION_KEY, trial),
      ]);
    },
    [identifier]
  );

  const updateProfile = useCallback(
    async (input: Partial<OnboardingInput> & Partial<UserProfile>) => {
      if (!profile) return;
      if (isApiConfigured) {
        const response = await api.updateProfile(input);
        setProfile(response.profile);
        await setSecureJson(PROFILE_KEY, response.profile);
        return;
      }
      const nextProfile: UserProfile = {
        ...profile,
        ...input,
        birth: { ...profile.birth },
      };
      setProfile(nextProfile);
      await setSecureJson(PROFILE_KEY, nextProfile);
    },
    [profile]
  );

  const refreshSubscription = useCallback(async () => {
    if (!isApiConfigured) return;
    const next = await api.subscriptionStatus();
    setSubscription(next);
    await setSecureJson(SUBSCRIPTION_KEY, next);
  }, []);

  const activateLocalTrial = useCallback(async () => {
    if (isApiConfigured || subscription.isPremium) return;
    const next = newTrial();
    setSubscription(next);
    await setSecureJson(SUBSCRIPTION_KEY, next);
  }, [subscription.isPremium]);

  const clearPrivateState = useCallback(async () => {
    await Promise.all([
      deleteSecureValue(SESSION_KEY),
      deleteSecureValue(REFRESH_SESSION_KEY),
      deleteSecureValue(PROFILE_KEY),
      deleteSecureValue(SUBSCRIPTION_KEY),
    ]);
    setToken(null);
    setProfile(null);
    setSubscription(limitedSubscription);
    setIdentifier("");
  }, []);

  const logout = useCallback(clearPrivateState, [clearPrivateState]);

  const deleteAccount = useCallback(async () => {
    if (isApiConfigured) await api.deleteAccount();
    await clearPrivateState();
  }, [clearPrivateState]);

  const value = useMemo(
    () => ({
      booting,
      isAuthenticated: Boolean(token),
      isApiConfigured,
      profile,
      subscription,
      requestOtp,
      verifyOtp,
      completeOnboarding,
      updateProfile,
      refreshSubscription,
      activateLocalTrial,
      logout,
      deleteAccount,
    }),
    [
      booting,
      token,
      profile,
      subscription,
      requestOtp,
      verifyOtp,
      completeOnboarding,
      updateProfile,
      refreshSubscription,
      activateLocalTrial,
      logout,
      deleteAccount,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = React.useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
