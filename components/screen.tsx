import React from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

import { spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

export function Screen({ contentContainerStyle, style, ...props }: ScrollViewProps) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 48, gap: spacing.lg },
        contentContainerStyle
      ]}
      {...props}
    />
  );
}
