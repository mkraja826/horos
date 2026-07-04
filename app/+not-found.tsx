import { Link, Stack } from "expo-router";
import React from "react";
import { Pressable } from "react-native";

import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { useAppTheme } from "@/providers/theme-provider";

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <Stack.Screen options={{ title: "Page not found" }} />
      <Card style={{ alignItems: "center" }}>
        <AppText variant="title">This page has moved</AppText>
        <AppText muted style={{ textAlign: "center" }}>
          Let’s return to your daily guidance.
        </AppText>
        <Link href="/home" asChild>
          <Pressable>
            <AppText variant="label" color={colors.primary} selectable={false}>
              Go to home
            </AppText>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}
