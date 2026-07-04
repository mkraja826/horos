import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppText } from "@/components/app-text";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

const benefits = [
  { icon: "sun", title: "Daily clarity", text: "A simple focus for family, work and wellbeing." },
  { icon: "calendar", title: "Weekly & monthly guidance", text: "Plan important days with a calm perspective." },
  { icon: "flame", title: "Gentle remedies", text: "Simple mantras and spiritual practices—never fear-based." },
  { icon: "star", title: "Your Vedic chart", text: "Rashi, Nakshatra and Lagna explained in plain language." }
];

export default function WelcomeScreen() {
  const { colors } = useAppTheme();
  return (
    <Screen contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <LinearGradient
        colors={["#172A52", "#314978"]}
        style={{ paddingTop: 72, paddingBottom: 44, paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.lg }}
      >
        <BrandMark size={84} />
        <AppText variant="title" color="#FFF8E9" style={{ textAlign: "center" }}>
          A calm companion for every day
        </AppText>
        <AppText color="#E8DDC8" style={{ textAlign: "center" }}>
          Personal Vedic guidance for the responsibilities, relationships and routines that matter to your family.
        </AppText>
      </LinearGradient>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Card style={{ marginTop: -34 }}>
          {benefits.map((benefit, index) => (
            <View
              key={benefit.title}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingBottom: index < benefits.length - 1 ? spacing.md : 0,
                borderBottomColor: colors.border,
                borderBottomWidth: index < benefits.length - 1 ? 1 : 0
              }}
            >
              <IconBadge name={benefit.icon} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{benefit.title}</AppText>
                <AppText variant="caption" muted>
                  {benefit.text}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
        <AppButton label="Get started" icon="chevron" onPress={() => router.push("/login")} />
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          Your first 30 days include complete access. Then ₹10/month, only if you choose to subscribe.
        </AppText>
      </View>
    </Screen>
  );
}
