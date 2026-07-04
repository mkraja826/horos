import React from "react";
import { ActivityIndicator, Pressable, type PressableProps, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type AppButtonProps = PressableProps & {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
  loading?: boolean;
};

export function AppButton({
  label,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  ...props
}: AppButtonProps) {
  const { colors } = useAppTheme();
  const foreground =
    variant === "primary" ? colors.white : variant === "danger" ? colors.maroon : colors.primary;
  const background =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.primarySoft
        : variant === "danger"
          ? `${colors.maroon}18`
          : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      style={(state) => [
        {
          minHeight: 54,
          borderRadius: radius.md,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          backgroundColor: background,
          opacity: disabled ? 0.48 : state.pressed ? 0.78 : 1,
          borderColor: variant === "ghost" ? colors.border : "transparent",
          borderWidth: variant === "ghost" ? 1 : 0
        },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : icon ? (
          <AppIcon name={icon} size={20} color={foreground} strokeWidth={2} />
        ) : null}
        <AppText variant="label" color={foreground} selectable={false} style={{ fontSize: 16 }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}
