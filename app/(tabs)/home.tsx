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
import { useDailyReading } from "@/hooks/use-vedic-data";
import {
  buildProviderTodayGuidance,
  consumerDomainTitle,
  type ConsumerTone,
} from "@/lib/today-guidance";
import {
  isPhase4AnalysisUiEnabled,
  isPhase4CompatibilityUiEnabled,
} from "@/lib/feature-flags";
import { formatLongDate } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function HomeScreen() {
  const { profile, subscription, isAuthenticated } = useApp();
  const { colors } = useAppTheme();
  const reading = useDailyReading();
  const today =
    reading.data && "results" in reading.data
      ? buildProviderTodayGuidance(reading.data)
      : null;
  const editorial =
    reading.data && !("results" in reading.data)
      ? reading.data
      : null;

  useEffect(() => {
    if (!isAuthenticated) router.replace("/welcome");
    else if (!profile) router.replace("/onboarding");
  }, [isAuthenticated, profile]);

  if (!profile) return <Screen />;

  const toneColor = (tone: ConsumerTone) => {
    if (tone === "supportive") return colors.success;
    if (tone === "sensitive") return colors.maroon;
    if (tone === "balanced") return colors.warning;
    return colors.textMuted;
  };

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
        <LoadingCard label="Preparing today’s guidance…" />
      ) : reading.isError || !reading.data ? (
        <QueryError onRetry={() => reading.refetch()} />
      ) : today ? (
        <>
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
                top: -80,
                right: -55,
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
                <AppIcon name="sun" size={24} color="#F2C66D" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label" color="#EADFC8">
                  Today’s guidance
                </AppText>
                <AppText variant="caption" color="#DCD3C2">
                  {today.signalLabel} · {today.patternLabel}
                  {today.sourceDomain ? ` · ${consumerDomainTitle(today.sourceDomain)}` : ""}
                </AppText>
              </View>
            </View>
            <AppText variant="title" color="#FFF8E9">
              {today.headline}
            </AppText>
            <AppText color="#E8DFD2">{today.summary}</AppText>
          </Card>

          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Your day at a glance</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {today.areas.map((area) => (
                <Card
                  key={area.key}
                  tone={area.tone === "supportive" ? "blue" : area.tone === "sensitive" ? "warm" : "default"}
                  style={{ flexBasis: "47%", flexGrow: 1, padding: spacing.md, gap: spacing.sm }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppIcon name={area.icon} size={18} color={toneColor(area.tone)} />
                    <AppText variant="label" style={{ flex: 1 }}>
                      {area.label}
                    </AppText>
                  </View>
                  <AppText variant="heading" color={toneColor(area.tone)}>
                    {area.status}
                  </AppText>
                  <AppText variant="caption" muted numberOfLines={3}>
                    {area.note}
                  </AppText>
                </Card>
              ))}
            </View>
          </View>

          <Card tone="blue">
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
              <IconBadge name="check" tone="blue" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="label">Today’s action</AppText>
                <AppText>{today.action}</AppText>
              </View>
            </View>
          </Card>

          {today.supportiveWindow || today.sensitiveWindow ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {today.supportiveWindow ? (
                <Card tone="blue" style={{ flex: 1, padding: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppIcon name="clock" size={17} color={colors.success} />
                    <AppText variant="caption" muted>
                      Supportive window
                    </AppText>
                  </View>
                  <AppText variant="label">{today.supportiveWindow}</AppText>
                </Card>
              ) : null}
              {today.sensitiveWindow ? (
                <Card tone="warm" style={{ flex: 1, padding: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppIcon name="alert" size={17} color={colors.maroon} />
                    <AppText variant="caption" muted>
                      Stay mindful
                    </AppText>
                  </View>
                  <AppText variant="label">{today.sensitiveWindow}</AppText>
                </Card>
              ) : null}
            </View>
          ) : null}

          <AppButton
            label="See today’s details"
            icon="sparkle"
            variant="secondary"
            onPress={() => router.push("/daily")}
          />
        </>
      ) : editorial ? (
        <>
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
                  width: 46,
                  height: 46,
                  borderRadius: radius.pill,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppIcon name="sun" size={24} color="#F2C66D" />
              </View>
              <AppText variant="label" color="#EADFC8">
                Your focus today
              </AppText>
            </View>
            <AppText variant="title" color="#FFF8E9">
              {editorial.focus}
            </AppText>
            <AppText color="#E8DFD2">{editorial.summary}</AppText>
            <AppButton
              label="View full daily guidance"
              variant="secondary"
              onPress={() => router.push("/daily")}
            />
          </Card>

          <Card>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
              <IconBadge name="flame" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="label">A simple action</AppText>
                <AppText muted>{editorial.remedy}</AppText>
              </View>
            </View>
          </Card>
        </>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <AppText variant="heading">Look ahead</AppText>
        {[
          {
            href: "/weekly" as const,
            title: "Weekly guidance",
            text: "Your strongest themes, sensitive days and practical weekly focus",
            icon: "calendar",
          },
          {
            href: "/monthly" as const,
            title: "Monthly guidance",
            text: "Planning themes, changing patterns and a useful monthly intention",
            icon: "moon",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <IconBadge name={item.icon} tone="blue" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <AppText variant="label">{item.title}</AppText>
                      {!subscription.isPremium && (
                        <AppIcon name="crown" size={15} color={colors.gold} />
                      )}
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

        {isPhase4AnalysisUiEnabled
          ? [
              {
                href: "/life-profile" as const,
                title: "My Life Profile",
                text: "Traits, relationships, work, resources and wellbeing",
                icon: "profile",
              },
              {
                href: "/year-analysis" as const,
                title: "Year roadmap",
                text: "A clear twelve-month view of stronger and more sensitive periods",
                icon: "calendar",
              },
              {
                href: "/month-analysis" as const,
                title: "Explore a month",
                text: "Select any month and review seven important life areas",
                icon: "moon",
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <IconBadge name={item.icon} tone="blue" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                        >
                          <AppText variant="label">{item.title}</AppText>
                          {!subscription.isPremium && (
                            <AppIcon name="crown" size={15} color={colors.gold} />
                          )}
                        </View>
                        <AppText variant="caption" muted>{item.text}</AppText>
                      </View>
                      <AppIcon name="chevron" size={21} color={colors.textMuted} />
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))
          : null}

        {isPhase4CompatibilityUiEnabled ? (
          <Link href="/compatibility" asChild>
            <Pressable>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <IconBadge name="heart" tone="warm" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <AppText variant="label">Relationship compatibility</AppText>
                      {!subscription.isPremium && (
                        <AppIcon name="crown" size={15} color={colors.gold} />
                      )}
                    </View>
                    <AppText variant="caption" muted>
                      Understand strengths, communication patterns and areas needing care
                    </AppText>
                  </View>
                  <AppIcon name="chevron" size={21} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          </Link>
        ) : null}
      </View>

      <SubscriptionBanner />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Traditional astrology guidance for reflection—not a guarantee or replacement for
        professional advice.
      </AppText>
    </Screen>
  );
}
