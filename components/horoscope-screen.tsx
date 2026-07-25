import React from "react";
import { View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { LoadingCard, QueryError } from "@/components/query-state";
import { PremiumLock } from "@/components/premium-lock";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { radius, spacing } from "@/constants/theme";
import {
  consumerAction,
  consumerDomainTitle,
  consumerPatternLabel,
  consumerResultSummary,
  consumerSignalLabel,
  consumerTone,
  type ConsumerTone,
} from "@/lib/today-guidance";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";
import type {
  HoroscopeReading,
  PredictionEvidence,
} from "@/types/models";

type HoroscopeScreenProps = {
  reading?: HoroscopeReading;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  periodRequiresPremium?: boolean;
};

function EvidenceList({
  title,
  evidence,
  color,
}: {
  title: string;
  evidence: PredictionEvidence[];
  color: string;
}) {
  if (!evidence.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color={color}>{title}</AppText>
      {evidence.map((factor) => (
        <View
          key={factor.evidence_id}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: color,
            paddingLeft: spacing.md,
            gap: spacing.xs,
          }}
        >
          <AppText>{factor.statement}</AppText>
          <AppText variant="caption" muted>{factor.reason}</AppText>
        </View>
      ))}
    </View>
  );
}

export function HoroscopeScreen({
  reading,
  loading,
  error,
  onRetry,
  periodRequiresPremium = false,
}: HoroscopeScreenProps) {
  const { subscription } = useApp();
  const { colors } = useAppTheme();

  if (periodRequiresPremium && !subscription.isPremium) {
    return (
      <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <PremiumLock />
      </Screen>
    );
  }

  if (loading) return <Screen><LoadingCard /></Screen>;
  if (error || !reading) return <Screen><QueryError onRetry={onRetry} /></Screen>;

  const toneColor = (tone: ConsumerTone) => {
    if (tone === "supportive") return colors.success;
    if (tone === "sensitive") return colors.maroon;
    if (tone === "balanced") return colors.warning;
    return colors.textMuted;
  };

  if ("results" in reading) {
    return (
      <Screen>
        <Card
          style={{
            backgroundColor: colors.secondary,
            borderColor: colors.secondary,
            padding: spacing.xl,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon
                name={reading.period === "daily" ? "sun" : reading.period === "weekly" ? "calendar" : "moon"}
                color="#F2C66D"
                size={25}
              />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="caption" color="#DCD3C2">
                {reading.period === "daily" ? "Today’s guidance" : `${reading.period} guidance`}
              </AppText>
              <AppText variant="heading" color="#FFF8E9">
                Your personalized Vedic reading
              </AppText>
            </View>
          </View>
          <AppText color="#E9E1D5">
            Built from your birth chart and active Vimśottarī daśā. Patterns are shown as
            supportive, mixed, sensitive or quiet—not as guarantees.
          </AppText>
        </Card>

        {reading.results.map((result) => {
          const tone = consumerTone(result);
          const color = toneColor(tone);
          return (
            <Card
              key={result.domain}
              tone={tone === "supportive" ? "blue" : tone === "sensitive" ? "warm" : "default"}
              style={{ padding: spacing.lg, gap: spacing.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="heading">{consumerDomainTitle(result.domain)}</AppText>
                  <AppText variant="label" color={color}>
                    {consumerSignalLabel(result)} · {consumerPatternLabel(result)}
                  </AppText>
                </View>
                <AppIcon
                  name={tone === "supportive" ? "sparkle" : tone === "sensitive" ? "alert" : "leaf"}
                  size={24}
                  color={color}
                />
              </View>

              <AppText>{consumerResultSummary(result)}</AppText>

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">Practical guidance</AppText>
                <AppText>{consumerAction(result)}</AppText>
              </View>

              {result.favourable_timing || result.challenging_timing ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {result.favourable_timing ? (
                    <Card tone="blue" style={{ flex: 1, padding: spacing.md }}>
                      <AppText variant="caption" muted>Supportive window</AppText>
                      <AppText variant="label">{result.favourable_timing}</AppText>
                    </Card>
                  ) : null}
                  {result.challenging_timing ? (
                    <Card tone="warm" style={{ flex: 1, padding: spacing.md }}>
                      <AppText variant="caption" muted>Stay mindful</AppText>
                      <AppText variant="label">{result.challenging_timing}</AppText>
                    </Card>
                  ) : null}
                </View>
              ) : null}

              {result.supporting_factors.length ||
              result.challenging_factors.length ||
              result.contextual_factors.length ? (
                <View style={{ gap: spacing.md }}>
                  <AppText variant="heading">Why this guidance?</AppText>
                  <EvidenceList
                    title="Supportive factors"
                    evidence={result.supporting_factors}
                    color={colors.success}
                  />
                  <EvidenceList
                    title="Factors needing care"
                    evidence={result.challenging_factors}
                    color={colors.maroon}
                  />
                  <EvidenceList
                    title="Context"
                    evidence={result.contextual_factors}
                    color={colors.warning}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}

        <SectionCard title="Interpretation boundary" icon="shield">
          <AppText muted>{reading.disclaimer}</AppText>
        </SectionCard>
      </Screen>
    );
  }

  const locked = !subscription.isPremium;
  const visibleSections = periodRequiresPremium && locked
    ? []
    : reading.sections.filter((section) => !locked || !section.premium);

  return (
    <Screen>
      <Card
        style={{
          backgroundColor: colors.secondary,
          borderColor: colors.secondary,
          padding: spacing.xl,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppIcon
              name={reading.period === "daily" ? "sun" : reading.period === "weekly" ? "calendar" : "moon"}
              color="#F2C66D"
              size={25}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="#DCD3C2">{reading.label}</AppText>
            <AppText variant="heading" color="#FFF8E9">{reading.focus}</AppText>
          </View>
        </View>
        <AppText color="#E9E1D5">{reading.summary}</AppText>
        {reading.calculationMode === "estimated" && process.env.EXPO_PUBLIC_APP_ENV !== "production" ? (
          <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
            <AppText variant="caption" color="#E9E1D5">Preview calculation</AppText>
          </View>
        ) : null}
      </Card>

      {reading.period === "daily" && (!periodRequiresPremium || !locked) ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Card tone="blue" style={{ flex: 1, padding: spacing.md }}>
            <AppText variant="caption" muted>Supportive time</AppText>
            <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>{reading.auspiciousTime}</AppText>
          </Card>
          <Card tone="warm" style={{ flex: 1, padding: spacing.md }}>
            <AppText variant="caption" muted>Stay mindful</AppText>
            <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>{reading.cautionTime}</AppText>
          </Card>
        </View>
      ) : null}

      {visibleSections.map((section) => (
        <SectionCard key={section.key} title={section.title} icon={section.icon}>
          <AppText muted>{section.content}</AppText>
        </SectionCard>
      ))}

      {locked ? <PremiumLock /> : null}

      {(!locked || !periodRequiresPremium) && (
        <SectionCard
          title={reading.period === "daily" ? "Today’s action" : `${reading.period === "weekly" ? "Weekly" : "Monthly"} action`}
          icon="flame"
        >
          <AppText muted>{reading.remedy}</AppText>
          {reading.mantra ? (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}>
              <AppText variant="caption" color={colors.primary}>Suggested mantra</AppText>
              <AppText variant="heading">{reading.mantra} · 11 times</AppText>
            </View>
          ) : null}
        </SectionCard>
      )}

      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Guidance is offered for reflection. Use your own judgment for personal, medical, legal
        and financial decisions.
      </AppText>
    </Screen>
  );
}
