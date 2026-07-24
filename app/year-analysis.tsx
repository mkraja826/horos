import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import {
  humanize,
  OutlookIndexCard,
} from "@/components/analysis-cards";
import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { FormField } from "@/components/form-field";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { ApiError, api } from "@/lib/api-client";
import { isPhase4AnalysisUiEnabled } from "@/lib/feature-flags";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function validYear(value: string) {
  const year = Number(value);
  return /^\d{4}$/.test(value) && Number.isInteger(year) && year >= 1900 && year <= 2200;
}

export default function YearAnalysisScreen() {
  const { isAuthenticated, profile, subscription } = useApp();
  const { colors } = useAppTheme();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [requestedYear, setRequestedYear] = useState<number | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["phase4-analysis", "year", requestedYear],
    queryFn: () => api.yearAnalysis(requestedYear!),
    enabled:
      isPhase4AnalysisUiEnabled &&
      isAuthenticated &&
      Boolean(profile) &&
      subscription.isPremium &&
      requestedYear !== null,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!isPhase4AnalysisUiEnabled) router.replace("/home");
    else if (!isAuthenticated) router.replace("/welcome");
    else if (!profile) router.replace("/onboarding");
    else if (!subscription.isPremium) router.replace("/subscription");
  }, [isAuthenticated, profile, subscription.isPremium]);

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 402) {
      router.replace("/subscription");
    }
  }, [query.error]);

  if (!isPhase4AnalysisUiEnabled || !profile || !subscription.isPremium) {
    return <Screen />;
  }

  function generate() {
    const normalized = year.trim();
    if (!validYear(normalized)) {
      setError("Enter a four-digit year between 1900 and 2200.");
      return;
    }
    setError("");
    setRequestedYear(Number(normalized));
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Year analysis</AppText>
        <AppText muted>
          Review a comparable twelve-month timeline with seven domain outlooks and explicit
          confidence limits.
        </AppText>
      </View>

      <Card>
        <FormField
          label="Calendar year"
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          maxLength={4}
          error={error}
        />
        <AppButton label="Generate twelve-month analysis" icon="calendar" onPress={generate} />
      </Card>

      <Card tone="warm">
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <AppIcon name="shield" size={22} color={colors.primary} />
          <AppText muted style={{ flex: 1 }}>
            Each month is sampled consistently at local noon on the 15th. Rankings compare the
            available evidence; they do not predict exact events or dates.
          </AppText>
        </View>
      </Card>

      {query.isLoading ? (
        <LoadingCard label={`Building the ${requestedYear} timeline…`} />
      ) : query.isError ? (
        <QueryError onRetry={() => query.refetch()} />
      ) : query.data ? (
        <>
          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">{query.data.interpretation.year} overview</AppText>
            {query.data.interpretation.overview_indices.map((index) => (
              <OutlookIndexCard key={index.domain} index={index} />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Card tone="blue" style={{ flex: 1 }}>
              <AppText variant="caption" muted>
                Stronger comparison months
              </AppText>
              <AppText variant="label">
                {query.data.interpretation.strongest_months
                  .map((month) => MONTH_NAMES[month - 1])
                  .join(", ") || "Insufficient evidence"}
              </AppText>
            </Card>
            <Card tone="warm" style={{ flex: 1 }}>
              <AppText variant="caption" muted>
                More challenging months
              </AppText>
              <AppText variant="label">
                {query.data.interpretation.challenging_months
                  .map((month) => MONTH_NAMES[month - 1])
                  .join(", ") || "Insufficient evidence"}
              </AppText>
            </Card>
          </View>

          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Twelve-month timeline</AppText>
            {query.data.interpretation.months.map((month) => {
              const overall = month.indices.find((index) => index.domain === "overall");
              return (
                <Pressable
                  key={month.month}
                  onPress={() =>
                    router.push({
                      pathname: "/month-analysis",
                      params: { year: month.year, month: month.month },
                    })
                  }
                >
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="label">{MONTH_NAMES[month.month - 1]}</AppText>
                        <AppText variant="caption" muted>
                          {overall?.score === null || overall?.score === undefined
                            ? "Not enough evidence"
                            : `${overall.score} / 100 · ${humanize(overall.band)}`}
                        </AppText>
                      </View>
                      <AppIcon name="chevron" size={21} color={colors.textMuted} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          <Card tone="blue">
            <AppText variant="heading">Coverage boundary</AppText>
            <AppText>
              Available: {query.data.facts.channels_available.join(", ")}
            </AppText>
            <AppText muted>
              Not included: {query.data.facts.channels_unavailable.join(", ")}.
              Missing channels lower confidence instead of being estimated.
            </AppText>
          </Card>

          <Card>
            <AppText variant="label">Interpretation disclaimer</AppText>
            <AppText muted>{query.data.interpretation.disclaimer}</AppText>
          </Card>
          <AppText variant="caption" muted style={{ textAlign: "center" }} selectable>
            Provider request: {query.data.provider.requestId}
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}
