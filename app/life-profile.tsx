import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import {
  AnalysisSectionCard,
  OutlookIndexCard,
} from "@/components/analysis-cards";
import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { ApiError, api } from "@/lib/api-client";
import { isPhase4AnalysisUiEnabled } from "@/lib/feature-flags";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function LifeProfileScreen() {
  const { isAuthenticated, profile, subscription } = useApp();
  const { colors } = useAppTheme();
  const report = useQuery({
    queryKey: ["phase4-analysis", "life-profile"],
    queryFn: api.lifeProfile,
    enabled:
      isPhase4AnalysisUiEnabled &&
      isAuthenticated &&
      Boolean(profile) &&
      subscription.isPremium,
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
    if (report.error instanceof ApiError && report.error.status === 402) {
      router.replace("/subscription");
    }
  }, [report.error]);

  if (!isPhase4AnalysisUiEnabled || !profile || !subscription.isPremium) {
    return <Screen />;
  }

  const indices =
    report.data?.interpretation.sections
      .map((section) => section.outlook_index)
      .filter((index) => index !== null) ?? [];

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">My Life Profile</AppText>
        <AppText muted>
          A source-traceable natal synthesis across temperament, relationships, work,
          resources, wellbeing and emotional balance.
        </AppText>
      </View>

      <Card tone="warm">
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <AppIcon name="shield" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="label">Interpretive, not fixed</AppText>
            <AppText muted>
              These sections describe traditional tendencies and mixed evidence. They are not
              diagnoses, probabilities or fixed statements about your identity or future.
            </AppText>
          </View>
        </View>
      </Card>

      {report.isLoading ? (
        <LoadingCard label="Building your Life Profile…" />
      ) : report.isError || !report.data ? (
        <QueryError onRetry={() => report.refetch()} />
      ) : (
        <>
          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Outlook indices</AppText>
            {indices.map((index) => (
              <OutlookIndexCard key={index.domain} index={index} />
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Profile sections</AppText>
            {report.data.interpretation.sections.map((section) => (
              <AnalysisSectionCard key={section.section} section={section} />
            ))}
          </View>

          <Card tone="blue">
            <AppText variant="heading">Coverage boundary</AppText>
            <AppText>
              Available: {report.data.facts.channels_available.join(", ")}
            </AppText>
            <AppText muted>
              Not included in this version: {report.data.facts.channels_unavailable.join(", ")}.
              Missing channels lower confidence instead of being estimated.
            </AppText>
          </Card>

          <Card>
            <AppText variant="label">Interpretation disclaimer</AppText>
            <AppText muted>{report.data.interpretation.disclaimer}</AppText>
          </Card>

          <AppButton
            label="Refresh Life Profile"
            icon="sparkle"
            variant="secondary"
            onPress={() => report.refetch()}
          />
          <AppText variant="caption" muted style={{ textAlign: "center" }} selectable>
            Provider request: {report.data.provider.requestId}
          </AppText>
        </>
      )}
    </Screen>
  );
}
