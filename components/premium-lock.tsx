import React from "react";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

export function PremiumLock({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <Card tone="warm" style={{ alignItems: "center", padding: compact ? spacing.md : spacing.xl }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface
        }}
      >
        <AppIcon name="crown" size={23} color={colors.gold} />
      </View>
      <AppText variant={compact ? "label" : "heading"} style={{ textAlign: "center" }}>
        Continue your complete guidance
      </AppText>
      {!compact ? (
        <AppText muted style={{ textAlign: "center" }}>
          Full daily, weekly and monthly readings are available during your trial or with the ₹10 monthly plan.
        </AppText>
      ) : null}
      <Link href="/subscription" asChild>
        <Pressable
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: spacing.xl,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.78 : 1
          })}
        >
          <AppText variant="label" color={colors.white} selectable={false}>
            View plan
          </AppText>
        </Pressable>
      </Link>
    </Card>
  );
}
