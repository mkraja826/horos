import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, View } from "react-native";

import { AppText } from "@/components/app-text";
import { BrandMark } from "@/components/brand-mark";
import { spacing } from "@/constants/theme";
import { useApp } from "@/providers/app-provider";

export default function SplashScreen() {
  const { booting, isAuthenticated, profile } = useApp();

  useEffect(() => {
    if (booting) return;
    const timer = setTimeout(() => {
      if (profile) router.replace("/home");
      else if (isAuthenticated) router.replace("/onboarding");
      else router.replace("/welcome");
    }, 900);
    return () => clearTimeout(timer);
  }, [booting, isAuthenticated, profile]);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
      <LinearGradient
        colors={["#111E3E", "#263D70", "#5D3543"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, minHeight: 700, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <View
          style={{
            position: "absolute",
            width: 340,
            height: 340,
            borderRadius: 170,
            borderWidth: 1,
            borderColor: "rgba(229,181,84,0.18)",
            top: -110,
            right: -150
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: "rgba(218,126,67,0.08)",
            bottom: -80,
            left: -90
          }}
        />
        <View style={{ alignItems: "center", gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <BrandMark />
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <AppText variant="display" color="#FFF8E9" style={{ textAlign: "center" }}>
              Daily Vedic Astro
            </AppText>
            <AppText color="#E9D9B8" style={{ textAlign: "center" }}>
              Daily Vedic Guidance for Your Life
            </AppText>
          </View>
          <View style={{ width: 46, height: 2, backgroundColor: "#D9A84F", borderRadius: 2 }} />
        </View>
      </LinearGradient>
    </ScrollView>
  );
}
