import { useQuery } from "@tanstack/react-query";

import { api, isApiConfigured } from "@/lib/api-client";
import { chartFixture, dailyFixture, monthlyFixture, panchangFixture, weeklyFixture } from "@/lib/fixtures";
import { useApp } from "@/providers/app-provider";
import type { BirthChart, HoroscopeReading, Panchang } from "@/types/models";

const allowDemoData = !isApiConfigured || process.env.EXPO_PUBLIC_ALLOW_DEMO_DATA === "true";

async function withPreviewFallback<T>(request: () => Promise<T>, fallback: () => T) {
  if (!isApiConfigured) return fallback();
  try {
    return await request();
  } catch (error) {
    if (allowDemoData) return fallback();
    throw error;
  }
}

export function useDailyReading() {
  const { profile } = useApp();
  return useQuery<HoroscopeReading>({
    queryKey: ["horoscope", "daily", profile?.id],
    queryFn: () => withPreviewFallback(api.daily, () => dailyFixture(profile ?? undefined)),
    staleTime: 1000 * 60 * 30
  });
}

export function useWeeklyReading() {
  const { profile } = useApp();
  return useQuery<HoroscopeReading>({
    queryKey: ["horoscope", "weekly", profile?.id],
    queryFn: () => withPreviewFallback(api.weekly, weeklyFixture),
    staleTime: 1000 * 60 * 60 * 6
  });
}

export function useMonthlyReading() {
  const { profile } = useApp();
  return useQuery<HoroscopeReading>({
    queryKey: ["horoscope", "monthly", profile?.id],
    queryFn: () => withPreviewFallback(api.monthly, monthlyFixture),
    staleTime: 1000 * 60 * 60 * 12
  });
}

export function usePanchang() {
  const { profile } = useApp();
  return useQuery<Panchang>({
    queryKey: ["panchang", profile?.birth.currentCity ?? profile?.birth.birthPlace],
    queryFn: () =>
      withPreviewFallback(api.panchang, () => ({
        ...panchangFixture,
        location: profile?.birth.currentCity ?? profile?.birth.birthPlace ?? panchangFixture.location
      })),
    staleTime: 1000 * 60 * 30
  });
}

export function useBirthChart() {
  const { profile } = useApp();
  return useQuery<BirthChart>({
    queryKey: ["birth-chart", profile?.id],
    queryFn: () => withPreviewFallback(api.birthChart, () => chartFixture(profile ?? undefined)),
    staleTime: Infinity
  });
}
