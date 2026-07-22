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
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";
import type {
  HoroscopeReading,
  PredictionDomainResult,
  PredictionEvidence,
} from "@/types/models";

type HoroscopeScreenProps = {
  reading?: HoroscopeReading;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  periodRequiresPremium?: boolean;
};

const domainTitles: Record<string, string> = {
  overall: "Overall outlook",
  career: "Career & work",
  money_resources: "Money & resources",
  relationships_marriage: "Relationships & marriage",
  family_home: "Family & home",
  education_creativity: "Education & creativity",
  wellbeing: "Wellbeing tendencies",
  travel_change: "Travel & change",
  spirituality: "Spirituality",
};

function outlookLabel(outlook: PredictionDomainResult["outlook"]): string {
  if (outlook === "insufficient" || outlook === "insufficient_evidence") {
    return "Insufficient evidence";
  }
  return outlook.charAt(0).toUpperCase() + outlook.slice(1);
}

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
          {factor.source_rule_ids.length ? (
            <AppText variant="caption" muted>
              Sources: {factor.source_rule_ids.join(", ")}
            </AppText>
          ) : null}
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
                {reading.period === "daily" ? "Current reading" : `${reading.period} reading`}
              </AppText>
              <AppText variant="heading" color="#FFF8E9">
                Varāhamihira interpretation
              </AppText>
            </View>
          </View>
          <AppText color="#E9E1D5">
            Calculated from your birth chart and active Vimśottarī daśā. Findings are shown directly, including challenging or insufficient evidence.
          </AppText>
          <AppText variant="caption" color="#DCD3C2">
            Profile: {reading.classical_profile} · Engine: {reading.engine_version}
          </AppText>
        </Card>

        {reading.results.map((result) => {
          const outlookColor = result.outlook === "favourable"
            ? colors.success
            : result.outlook === "challenging"
            ? colors.maroon
            : result.outlook === "mixed"
            ? colors.warning
            : colors.textMuted;
          return (
            <Card key={result.domain} style={{ padding: spacing.lg, gap: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="heading">{domainTitles[result.domain] ?? result.domain}</AppText>
                  <AppText variant="label" color={outlookColor}>
                    {outlookLabel(result.outlook)} · {result.strength} strength
                  </AppText>
                </View>
                <View
                  style={{
                    borderRadius: radius.pill,
                    backgroundColor: colors.surfaceMuted,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <AppText variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                    Net {result.net_score.toFixed(2)}
                  </AppText>
                </View>
              </View>

              <AppText>{result.statement}</AppText>
              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">Advisory</AppText>
                <AppText>{result.advisory}</AppText>
                {result.favourable_timing ? (
                  <AppText color={colors.success}>{result.favourable_timing}</AppText>
                ) : null}
                {result.challenging_timing ? (
                  <AppText color={colors.maroon}>{result.challenging_timing}</AppText>
                ) : null}
              </View>
              <EvidenceList title="Supporting factors" evidence={result.supporting_factors} color={colors.success} />
              <EvidenceList title="Challenging factors" evidence={result.challenging_factors} color={colors.maroon} />
              <EvidenceList title="Context and limitations" evidence={result.contextual_factors} color={colors.warning} />
            </Card>
          );
        })}

        <SectionCard title="Important disclaimer" icon="alert">
          <AppText muted>{reading.disclaimer}</AppText>
        </SectionCard>

        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          Calculation profile: {reading.calculation_profile}{"\n"}
          Request: {reading.provider.requestId}
        </AppText>
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
          <Card tone="warm" style={{ flex: 1, padding: spacing.md }}>
            <AppText variant="caption" muted>Favorable time</AppText>
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
          title={reading.period === "daily" ? "Today’s remedy" : `${reading.period === "weekly" ? "Weekly" : "Monthly"} remedy`}
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
        Guidance is offered for reflection. Please use your own judgment for personal, medical, legal and financial decisions.
      </AppText>
    </Screen>
  );
}
