import React from "react";
import { View, type ViewProps } from "react-native";

import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type CardProps = ViewProps & {
  tone?: "default" | "warm" | "blue";
  padded?: boolean;
};

export function Card({ tone = "default", padded = true, style, ...props }: CardProps) {
  const { colors, isDark } = useAppTheme();
  const backgroundColor =
    tone === "warm" ? colors.primarySoft : tone === "blue" ? colors.secondarySoft : colors.surface;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          padding: padded ? spacing.lg : 0,
          gap: spacing.md,
          boxShadow: isDark ? "0 8px 26px rgba(0,0,0,0.18)" : "0 8px 26px rgba(79,52,24,0.07)"
        },
        style
      ]}
      {...props}
    />
  );
}
