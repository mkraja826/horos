import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import {
  AnalysisSectionCard,
  OutlookIndexCard,
} from "@/components/analysis-cards";
import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { ChoiceChips } from "@/components/choice-chips";
import { FormField } from "@/components/form-field";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { ApiError, api } from "@/lib/api-client";
import { isPhase4AnalysisUiEnabled } from "@/lib/feature-flags";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
type MonthLabel = (typeof MONTHS)[number];

function validYear(value: string) {
  const year = Number(value);
  return /^\d{4}$/.test(value) && Number.isInteger(year) && year >= 1900 && year <= 2200;
}

export default function MonthAnalysisScreen() {
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const current = new Date();
  const initialYear = validYear(params.year ?? "")
    ? params.year!
    : String(current.getFullYear());
  const initialMonthIndex = Number(params.month);
  const initialMonth =
    Number.isInteger(initialMonthIndex) && initialMonthIndex >= 1 && initialMonthIndex <= 12
      ? MONTHS[initialMonthIndex - 1]
      : MONTHS[current.getMonth()];
  const { isAuthenticated, profile, subscription } = useApp();
  const { colors } = useAppTheme();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState<MonthLabel>(initialMonth);
  const [requested, setRequested] = useState<{ year: number; month: number } | null>(
    params.year && params.month && validYear(initialYear)
      ? { year: Number(initialYear), month: MONTHS.indexOf(initialMonth) + 1 }
      : null
  );
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["phase4-analysis", "month", requested?.year, requested?.month],
    queryFn: () => api.monthAnalysis(requested!.year, requested!.month),
    enabled:
      isPhase4AnalysisUiEnabled &&
      isAuthenticated &&
      Boolean(profile) &&
      subscription.isPremium &&
      requested !== null,
    staleTime: 12 * 60 * 60 * 1000,
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

  const title = useMemo(() => {
    if (!requested) return "Selected month";
    return `${MONTHS[requested.month - 1]} ${requested.year}`;
  }, [requested]);

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
    setRequested({ year: Number(normalized), month: MONTHS.indexOf(month) + 1 });
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Specific month analysis</AppText>
        <AppText muted>
          Compare seven life domains for a selected calendar month using an explicit,
          reproducible sampling method.
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
        <ChoiceChips label="Month" options={MONTHS} value={month} onChange={setMonth} />
        <AppButton label="Generate month analysis" icon="calendar" onPress={generate} />
      </Card>

      <Card tone="warm">
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <AppIcon name="shield" size={22} color={colors.primary} />
          <AppText muted style={{ flex: 1 }}>
            This version samples local noon on the 15th. It does not claim exact event dates,
            ingress times or outcomes.
          </AppText>
        </View>
      </Card>

      {query.isLoading ? (
        <LoadingCard label={`Preparing ${title}…`} />
      ) : query.isError ? (
        <QueryError onRetry={() => query.refetch()} />
      ) : query.data ? (
        <>
          <AppText variant="heading">{title}</AppText>
          <View style={{ gap: spacing.md }}>
            {query.data.interpretation.indices.map((index) => (
              <OutlookIndexCard key={index.domain} index={index} />
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Domain detail</AppText>
            {query.data.interpretation.sections.map((section) => (
              <AnalysisSectionCard key={section.section} section={section} />
            ))}
          </View>

          <Card tone="blue">
            <AppText variant="heading">Calculation coverage</AppText>
            <AppText>
              Available: {query.data.interpretation.channels_available.join(", ")}
            </AppText>
            <AppText muted>
              Not included: {query.data.interpretation.channels_unavailable.join(", ")}.
              Confidence is reduced rather than filling missing channels with estimates.
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
