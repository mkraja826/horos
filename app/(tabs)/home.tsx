import { Link, router } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { radius, spacing } from "@/constants/theme";
import { formatLongDate } from "@/lib/format";
import { useDailyReading } from "@/hooks/use-vedic-data";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function HomeScreen() {
  const { profile, subscription, isAuthenticated } = useApp();
  const { colors } = useAppTheme();
  const reading = useDailyReading();

  useEffect(() => {
    if (!isAuthenticated) router.replace("/welcome");
    else if (!profile) router.replace("/onboarding");
  }, [isAuthenticated, profile]);

  if (!profile) return <Screen />;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Namaste, {profile.fullName.split(" ")[0]} 🙏</AppText>
        <AppText variant="label" muted>
          {formatLongDate()}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Card style={{ flex: 1, padding: spacing.md, gap: 4 }}>
          <AppText variant="caption" muted>
            Your Rashi
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <AppIcon name="moon" size={18} color={colors.primary} />
            <AppText variant="label">{profile.rashi}</AppText>
          </View>
        </Card>
        <Card style={{ flex: 1, padding: spacing.md, gap: 4 }}>
          <AppText variant="caption" muted>
            Nakshatra
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <AppIcon name="star" size={18} color={colors.gold} />
            <AppText variant="label">{profile.nakshatra}</AppText>
          </View>
        </Card>
      </View>

      {reading.isLoading ? (
        <LoadingCard />
      ) : reading.isError || !reading.data ? (
        <QueryError onRetry={() => reading.refetch()} />
      ) : (
        <>
          <Card
            style={{
              backgroundColor: colors.secondary,
              borderColor: colors.secondary,
              padding: spacing.xl,
              overflow: "hidden"
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
                top: -80,
                right: -55
              }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{ width: 46, height: 46, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}
              >
                <AppIcon name="sun" size={24} color="#F2C66D" />
              </View>
              <AppText variant="label" color="#EADFC8">
                Your favorable focus today
              </AppText>
            </View>
            <AppText variant="title" color="#FFF8E9">
              {reading.data.focus}
            </AppText>
            <AppText color="#E8DFD2">{reading.data.summary}</AppText>
            <AppButton label="View full daily reading" variant="secondary" onPress={() => router.push("/daily")} />
          </Card>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Card tone="warm" style={{ flex: 1, alignItems: "center", padding: spacing.md }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: reading.data.luckyColorHex, borderWidth: 2, borderColor: colors.surface }} />
              <AppText variant="caption" muted>
                Lucky color
              </AppText>
              <AppText variant="label" style={{ textAlign: "center" }}>
                {reading.data.luckyColor}
              </AppText>
            </Card>
            <Card tone="warm" style={{ flex: 1, alignItems: "center", padding: spacing.md }}>
              <AppIcon name="hash" size={28} color={colors.primary} />
              <AppText variant="caption" muted>
                Lucky number
              </AppText>
              <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>
                {reading.data.luckyNumber}
              </AppText>
            </Card>
          </View>

          <Card>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
              <IconBadge name="flame" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="label">A simple remedy</AppText>
                <AppText muted>{reading.data.remedy}</AppText>
              </View>
            </View>
          </Card>
        </>
      )}

      <View style={{ gap: spacing.md }}>
        <AppText variant="heading">Look ahead</AppText>
        {[
          { href: "/weekly" as const, title: "Weekly guidance", text: "Family harmony, work rhythm and favorable days", icon: "calendar" },
          { href: "/monthly" as const, title: "Monthly guidance", text: "Planning themes, important dates and spiritual focus", icon: "moon" }
        ].map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <IconBadge name={item.icon} tone="blue" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <AppText variant="label">{item.title}</AppText>
                      {!subscription.isPremium && <AppIcon name="crown" size={15} color={colors.gold} />}
                    </View>
                    <AppText variant="caption" muted>
                      {item.text}
                    </AppText>
                  </View>
                  <AppIcon name="chevron" size={21} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>

      <SubscriptionBanner />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Astrology-based guidance for reflection and entertainment—not a replacement for professional advice.
      </AppText>
    </Screen>
  );
}
