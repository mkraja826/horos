import { Link } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { Screen } from "@/components/screen";
import { radius, spacing } from "@/constants/theme";
import { formatTrialEnd } from "@/lib/format";
import { purchaseMonthly, restorePurchases } from "@/lib/purchases";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

const benefits = [
  "Complete daily guidance",
  "Weekly and monthly readings",
  "Local Panchang timings",
  "Simple remedies and mantras",
  "Birth chart summary",
  "Guidance notifications"
];

export default function SubscriptionScreen() {
  const { profile, subscription, refreshSubscription } = useApp();
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState<"purchase" | "restore" | null>(null);
  const [message, setMessage] = useState("");

  async function purchase() {
    if (!profile) return;
    setLoading("purchase");
    setMessage("");
    try {
      await purchaseMonthly(profile.id);
      await refreshSubscription();
      setMessage("Your subscription is active. Thank you.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The purchase could not be completed.");
    } finally {
      setLoading(null);
    }
  }

  async function restore() {
    if (!profile) return;
    setLoading("restore");
    setMessage("");
    try {
      await restorePurchases(profile.id);
      await refreshSubscription();
      setMessage("Your store purchases have been checked.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Purchases could not be restored.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
        <View
          style={{ width: 74, height: 74, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}
        >
          <AppIcon name="crown" size={34} color={colors.gold} />
        </View>
        <AppText variant="title" style={{ textAlign: "center" }}>Keep your complete guidance</AppText>
        <AppText muted style={{ textAlign: "center" }}>
          One simple plan for your daily, weekly and monthly Vedic companion.
        </AppText>
      </View>

      {subscription.status === "trial" ? (
        <Card tone="blue">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <IconBadge name="sparkle" tone="blue" />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">Your free month is active</AppText>
              <AppText variant="caption" muted>
                {subscription.daysRemaining} days remaining · ends {formatTrialEnd(subscription.trialEndsAt)}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={{ padding: spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <AppText variant="caption" color={colors.primary}>MONTHLY PLAN</AppText>
            <AppText variant="heading">Daily Vedic Premium</AppText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <AppText variant="display" style={{ fontVariant: ["tabular-nums"] }}>₹10</AppText>
            <AppText variant="caption" muted>per month</AppText>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border }} />
        {benefits.map((benefit) => (
          <View key={benefit} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: `${colors.success}20`, alignItems: "center", justifyContent: "center" }}>
              <AppIcon name="check" size={15} color={colors.success} />
            </View>
            <AppText style={{ flex: 1 }}>{benefit}</AppText>
          </View>
        ))}

        {subscription.status === "active" ? (
          <Card tone="blue" style={{ alignItems: "center", boxShadow: "none" }}>
            <AppText variant="label" color={colors.success}>Your subscription is active</AppText>
          </Card>
        ) : (
          <AppButton label="Subscribe for ₹10/month" icon="crown" onPress={purchase} loading={loading === "purchase"} />
        )}
        <AppButton label="Restore purchase" variant="ghost" onPress={restore} loading={loading === "restore"} />
      </Card>

      {message ? (
        <AppText color={message.includes("active") || message.includes("checked") ? colors.success : colors.maroon} style={{ textAlign: "center" }}>
          {message}
        </AppText>
      ) : null}

      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Payment is charged to your Apple ID or Google Play account. The monthly subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in your device’s store subscription settings.
      </AppText>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xl }}>
        <Link href="/terms" asChild>
          <Pressable><AppText variant="label" color={colors.primary} selectable={false}>Terms</AppText></Pressable>
        </Link>
        <Link href="/privacy" asChild>
          <Pressable><AppText variant="label" color={colors.primary} selectable={false}>Privacy</AppText></Pressable>
        </Link>
      </View>
    </Screen>
  );
}
