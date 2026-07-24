import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { radius, spacing } from "@/constants/theme";
import { isPhase4CompatibilityUiEnabled } from "@/lib/feature-flags";
import { useAppTheme } from "@/providers/theme-provider";
import type {
  CompatibilityBand,
  CompatibilityComponentName,
  CompatibilityReport,
} from "@/types/models";

const componentLabels: Record<CompatibilityComponentName, string> = {
  varna: "Varna",
  vashya: "Vashya",
  tara: "Tara",
  yoni: "Yoni",
  graha_maitri: "Graha Maitri",
  gana: "Gana",
  bhakoot: "Bhakoot",
  nadi: "Nadi",
};

const bandLabels: Record<CompatibilityBand, string> = {
  insufficient: "Not evaluated",
  challenging: "Challenging",
  mixed: "Mixed",
  supportive: "Supportive",
};

function titleCase(value: string | null) {
  if (!value) return "Not available";
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function points(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function CompatibilityReportScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const report = queryClient.getQueryData<CompatibilityReport>([
    "compatibility-report",
    "active",
  ]);

  useEffect(() => {
    if (!isPhase4CompatibilityUiEnabled) router.replace("/home");
  }, []);

  if (!isPhase4CompatibilityUiEnabled) return <Screen />;

  if (!report) {
    return (
      <Screen>
        <Card>
          <AppText variant="heading">No active compatibility report</AppText>
          <AppText muted>
            Compatibility reports are intentionally kept only in memory and are cleared when the
            app session is restarted.
          </AppText>
          <AppButton
            label="Start a new comparison"
            icon="sparkle"
            onPress={() => router.replace("/compatibility")}
          />
        </Card>
      </Screen>
    );
  }

  const { facts, interpretation } = report;
  const outlook = interpretation.partnership_index;
  const coveragePercent = Math.round(outlook.coverage * 100);

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Compatibility report</AppText>
        <AppText muted>
          A traditional component comparison with explicit coverage and interpretation limits.
        </AppText>
      </View>

      <Card
        style={{
          backgroundColor: colors.secondary,
          borderColor: colors.secondary,
          padding: spacing.xl,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            width: 170,
            height: 170,
            borderRadius: 85,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            top: -75,
            right: -50,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.pill,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppIcon name="star" size={24} color="#F2C66D" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="#EADFC8">
              Partnership outlook
            </AppText>
            <AppText variant="title" color="#FFF8E9">
              {outlook.score === null ? "Not enough evidence" : `${outlook.score} / 100`}
            </AppText>
          </View>
        </View>
        <AppText variant="heading" color="#FFF8E9">
          {titleCase(outlook.band)}
        </AppText>
        <AppText color="#E8DFD2">{outlook.disclaimer}</AppText>
        <AppText variant="caption" color="#DCD3C2">
          {coveragePercent}% calculation coverage · {titleCase(outlook.confidence_status)} confidence
        </AppText>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Card tone="warm" style={{ flex: 1, alignItems: "center", padding: spacing.md }}>
          <AppText variant="caption" muted>
            Traditional points
          </AppText>
          <AppText variant="heading">
            {points(facts.total_achieved_points)} / {facts.evaluated_maximum_points}
          </AppText>
          <AppText variant="caption" muted style={{ textAlign: "center" }}>
            {facts.evaluated_maximum_points} of 36 evaluated
          </AppText>
        </Card>
        <Card tone="blue" style={{ flex: 1, alignItems: "center", padding: spacing.md }}>
          <AppText variant="caption" muted>
            Components
          </AppText>
          <AppText variant="heading">
            {facts.ashtakoota_components.filter((item) => item.status === "evaluated").length} / 8
          </AppText>
          <AppText variant="caption" muted style={{ textAlign: "center" }}>
            evaluated truthfully
          </AppText>
        </Card>
      </View>

      {!facts.complete_36_point_evaluation ? (
        <Card tone="warm">
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
            <AppIcon name="shield" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="label">Partial role-neutral comparison</AppText>
              <AppText muted>
                Varna, Vashya and Gana were not scored because bride and groom roles were not
                supplied. Their missing points are not treated as zero.
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      {interpretation.strengths.length > 0 ? (
        <Card>
          <AppText variant="heading">Strengths</AppText>
          {interpretation.strengths.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppIcon name="star" size={17} color={colors.gold} />
              <AppText style={{ flex: 1 }}>{item}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {interpretation.cautions.length > 0 ? (
        <Card tone="warm">
          <AppText variant="heading">Cautions</AppText>
          {interpretation.cautions.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppIcon name="shield" size={17} color={colors.primary} />
              <AppText style={{ flex: 1 }}>{item}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <AppText variant="heading">Eight-component breakdown</AppText>
        {interpretation.components.map((item) => (
          <Card key={item.component}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{componentLabels[item.component]}</AppText>
                <AppText variant="caption" muted>
                  {bandLabels[item.band]}
                </AppText>
              </View>
              <AppText variant="heading">
                {item.achieved_points === null
                  ? "—"
                  : `${points(item.achieved_points)} / ${item.maximum_points}`}
              </AppText>
            </View>
            <AppText>{item.headline}</AppText>
            <AppText muted>{item.explanation}</AppText>
            {item.status === "abstained" ? (
              <AppText variant="caption" color={colors.maroon}>
                Not scored because the required directional role information was absent.
              </AppText>
            ) : null}
            <AppText variant="caption" muted selectable>
              Evidence: {item.evidence_refs.join(", ")}
            </AppText>
          </Card>
        ))}
      </View>

      <Card tone="blue">
        <AppText variant="heading">Manglik context</AppText>
        <AppText>{interpretation.manglik_context.comparison}</AppText>
        <AppText muted>
          Your flagged reference points: {interpretation.manglik_context.subject_flagged_count} of
          3 · Partner: {interpretation.manglik_context.partner_flagged_count} of 3
        </AppText>
        <AppText variant="caption" muted>
          {interpretation.manglik_context.disclaimer}
        </AppText>
      </Card>

      <Card>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <AppIcon name="shield" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="label">Interpretation boundary</AppText>
            <AppText muted>{interpretation.disclaimer}</AppText>
          </View>
        </View>
      </Card>

      <AppButton
        label="Compare another Kundli"
        icon="sparkle"
        onPress={() => {
          queryClient.removeQueries({ queryKey: ["compatibility-report", "active"] });
          router.replace("/compatibility");
        }}
      />
      <AppText variant="caption" muted style={{ textAlign: "center" }} selectable>
        Provider request: {report.provider.requestId}
      </AppText>
    </Screen>
  );
}
