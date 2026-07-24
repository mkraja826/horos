import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";
import type {
  AnalysisEvidence,
  AnalysisSection,
  OutlookIndex,
} from "@/types/phase4-analysis";

export function humanize(value: string | null | undefined) {
  if (!value) return "Not available";
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function OutlookIndexCard({ index }: { index: OutlookIndex }) {
  const coverage = Math.round(index.coverage * 100);
  return (
    <Card tone={index.score !== null && index.score >= 60 ? "blue" : "warm"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted>
            {humanize(index.domain)} outlook
          </AppText>
          <AppText variant="heading">
            {index.score === null ? "Not enough evidence" : `${index.score} / 100`}
          </AppText>
          <AppText variant="caption" muted>
            {humanize(index.band)} · {coverage}% coverage · {humanize(index.confidence_status)}
          </AppText>
        </View>
        <AppIcon name="sparkle" size={25} />
      </View>
      {index.conflict_status !== "none" && index.conflict_status !== "insufficient" ? (
        <AppText variant="caption" muted>
          Evidence includes {humanize(index.conflict_status).toLowerCase()}.
        </AppText>
      ) : null}
    </Card>
  );
}

function EvidenceGroup({ title, evidence }: { title: string; evidence: AnalysisEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{title}</AppText>
      {evidence.map((item) => (
        <View key={item.evidence_id} style={{ gap: 2 }}>
          <AppText>{item.statement}</AppText>
          <AppText variant="caption" muted selectable>
            {item.reason} Evidence: {item.source_rule_ids.join(", ") || item.evidence_id}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function AnalysisSectionCard({ section }: { section: AnalysisSection }) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const evidenceCount =
    section.supporting_evidence.length +
    section.challenging_evidence.length +
    section.contextual_evidence.length;

  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{section.headline}</AppText>
            <AppText variant="caption" muted>
              {humanize(section.confidence_status)} confidence
              {section.conflict_status !== "none"
                ? ` · ${humanize(section.conflict_status)}`
                : ""}
            </AppText>
          </View>
          {section.outlook_index ? (
            <AppText variant="heading">
              {section.outlook_index.score === null ? "—" : section.outlook_index.score}
            </AppText>
          ) : null}
        </View>
        <AppText>{section.narrative}</AppText>
        <AppText muted>{section.guidance}</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AppIcon name={expanded ? "x" : "book"} size={18} color={colors.primary} />
          <AppText variant="label" color={colors.primary}>
            {expanded ? "Hide evidence" : `View evidence (${evidenceCount})`}
          </AppText>
        </Pressable>
        {expanded ? (
          <View style={{ gap: spacing.lg }}>
            <EvidenceGroup title="Supporting" evidence={section.supporting_evidence} />
            <EvidenceGroup title="Challenging" evidence={section.challenging_evidence} />
            <EvidenceGroup title="Context" evidence={section.contextual_evidence} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
