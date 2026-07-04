import { Tabs } from "expo-router";
import React from "react";
import type { ColorValue } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { useAppTheme } from "@/providers/theme-provider";

const tabIcon = (name: string, color: ColorValue, size: number) => (
  <AppIcon name={name} color={color as string} size={size} strokeWidth={1.9} />
);

export default function TabLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68, paddingBottom: 8 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Today", tabBarIcon: ({ color, size }) => tabIcon("home", color, size) }} />
      <Tabs.Screen name="panchang" options={{ title: "Panchang", tabBarIcon: ({ color, size }) => tabIcon("calendar", color, size) }} />
      <Tabs.Screen name="remedies" options={{ title: "Remedies", tabBarIcon: ({ color, size }) => tabIcon("flame", color, size) }} />
      <Tabs.Screen name="chart" options={{ title: "My chart", tabBarIcon: ({ color, size }) => tabIcon("star", color, size) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => tabIcon("profile", color, size) }} />
    </Tabs>
  );
}
