import React from "react";
import { View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/card";
import { PremiumLock } from "@/components/premium-lock";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { radius, spacing } from "@/constants/theme";
import { useBirthChart } from "@/hooks/use-vedic-data";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function ChartScreen() {
  const { profile, subscription } = useApp();
  const { colors } = useAppTheme();
  const chart = useBirthChart();

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Your Vedic profile</AppText>
        <AppText muted>A clear summary without a wall of technical charts.</AppText>
      </View>

      {!subscription.isPremium ? (
        <PremiumLock />
      ) : chart.isLoading ? (
        <LoadingCard label="Preparing your chart summary…" />
      ) : chart.isError || !chart.data ? (
        <QueryError onRetry={() => chart.refetch()} />
      ) : (
        <>
          <Card style={{ alignItems: "center", backgroundColor: colors.secondary, borderColor: colors.secondary, padding: spacing.xl }}>
            <BrandMark size={74} />
            <AppText variant="heading" color="#FFF8E9">{profile?.fullName}</AppText>
            <AppText color="#DDD5C8" style={{ textAlign: "center" }}>
              {profile?.birth.dateOfBirth} · {profile?.birth.timeOfBirth}{"\n"}{profile?.birth.birthPlace}
            </AppText>
          </Card>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[
              ["Rashi", chart.data.rashi, "moon"],
              ["Nakshatra", chart.data.nakshatra, "star"],
              ["Lagna", chart.data.lagna, "sun"],
              ["Element", chart.data.element, "leaf"]
            ].map(([label, value, icon]) => (
              <Card key={label} style={{ width: "48%", flexGrow: 1, padding: spacing.md }}>
                <AppIcon name={icon} color={colors.primary} size={21} />
                <AppText variant="caption" muted>{label}</AppText>
                <AppText variant="label">{value}</AppText>
              </Card>
            ))}
          </View>

          <SectionCard title="Birth star & nature" icon="sparkle">
            <AppText>{chart.data.birthStar}</AppText>
            <AppText muted>{chart.data.nature}</AppText>
          </SectionCard>

          <SectionCard title="Natural strengths" icon="check">
            {chart.data.strengths.map((strength) => (
              <View key={strength} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: `${colors.success}20`, alignItems: "center", justifyContent: "center" }}>
                  <AppIcon name="check" size={14} color={colors.success} />
                </View>
                <AppText muted style={{ flex: 1 }}>{strength}</AppText>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Areas to balance" icon="alert">
            {chart.data.challenges.map((challenge) => (
              <View key={challenge} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 10, backgroundColor: colors.warning }} />
                <AppText muted style={{ flex: 1 }}>{challenge}</AppText>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Lifestyle balance" icon="heart">
            <AppText muted>{chart.data.lifestyleBalance}</AppText>
            {chart.data.dasha ? <AppText variant="caption" color={colors.primary}>Current period: {chart.data.dasha}</AppText> : null}
          </SectionCard>
        </>
      )}

      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Advanced divisional charts and detailed dasha tools are intentionally reserved for a later release.
      </AppText>
    </Screen>
  );
}
