import React from "react";
import { ActivityIndicator } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { useAppTheme } from "@/providers/theme-provider";

export function LoadingCard({ label = "Preparing your guidance…" }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <Card style={{ minHeight: 150, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText muted>{label}</AppText>
    </Card>
  );
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card tone="warm" style={{ alignItems: "center" }}>
      <AppText variant="heading" style={{ textAlign: "center" }}>
        Guidance could not be refreshed
      </AppText>
      <AppText muted style={{ textAlign: "center" }}>
        Your saved information is safe. Check your connection and try once more.
      </AppText>
      <AppButton label="Try again" variant="secondary" onPress={onRetry} />
    </Card>
  );
}
