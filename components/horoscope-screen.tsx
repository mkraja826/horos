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
import type { HoroscopeReading } from "@/types/models";

type HoroscopeScreenProps = {
  reading?: HoroscopeReading;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  periodRequiresPremium?: boolean;
};

export function HoroscopeScreen({
  reading,
  loading,
  error,
  onRetry,
  periodRequiresPremium = false
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
          overflow: "hidden"
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{ width: 48, height: 48, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}
          >
            <AppIcon name={reading.period === "daily" ? "sun" : reading.period === "weekly" ? "calendar" : "moon"} color="#F2C66D" size={25} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="#DCD3C2">
              {reading.label}
            </AppText>
            <AppText variant="heading" color="#FFF8E9">
              {reading.focus}
            </AppText>
          </View>
        </View>
        <AppText color="#E9E1D5">{reading.summary}</AppText>
        {reading.calculationMode === "estimated" && process.env.EXPO_PUBLIC_APP_ENV !== "production" ? (
          <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
            <AppText variant="caption" color="#E9E1D5">
              Preview calculation
            </AppText>
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
        <SectionCard title={reading.period === "daily" ? "Today’s remedy" : `${reading.period === "weekly" ? "Weekly" : "Monthly"} remedy`} icon="flame">
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
