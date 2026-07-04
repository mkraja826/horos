import React from "react";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { spacing } from "@/constants/theme";
import { formatTrialEnd } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export function SubscriptionBanner() {
  const { subscription } = useApp();
  const { colors } = useAppTheme();
  const description = subscription.isPremium
    ? subscription.status === "trial"
      ? `${subscription.daysRemaining} days remaining · ends ${formatTrialEnd(subscription.trialEndsAt)}`
      : `Your ₹10 monthly plan is active${subscription.subscriptionEndsAt ? ` until ${formatTrialEnd(subscription.subscriptionEndsAt)}` : ""}.`
    : "Basic daily guidance only · unlock the complete reading for ₹10/month.";

  return (
    <Link href="/subscription" asChild>
      <Pressable accessibilityRole="button">
        <Card tone={subscription.isPremium ? "blue" : "warm"}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <AppIcon name="crown" size={24} color={subscription.isPremium ? colors.secondary : colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">
                {subscription.status === "trial"
                  ? "Your free trial"
                  : subscription.isPremium
                    ? "Premium guidance"
                    : "Continue full access"}
              </AppText>
              <AppText variant="caption" muted selectable>
                {description}
              </AppText>
            </View>
            <AppIcon name="chevron" size={20} color={colors.textMuted} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
