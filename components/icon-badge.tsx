import React from "react";
import { View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { radius } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type IconBadgeProps = {
  name: string;
  size?: number;
  tone?: "warm" | "blue" | "gold";
};

export function IconBadge({ name, size = 42, tone = "warm" }: IconBadgeProps) {
  const { colors } = useAppTheme();
  const backgroundColor =
    tone === "blue" ? colors.secondarySoft : tone === "gold" ? `${colors.gold}24` : colors.primarySoft;
  const iconColor = tone === "blue" ? colors.secondary : tone === "gold" ? colors.gold : colors.primary;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor
      }}
    >
      <AppIcon name={name} size={size * 0.48} color={iconColor} strokeWidth={1.8} />
    </View>
  );
}
