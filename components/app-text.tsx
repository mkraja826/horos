import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";

import { useAppTheme } from "@/providers/theme-provider";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";

const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: -0.7 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -0.35 },
  heading: { fontSize: 20, lineHeight: 27, fontWeight: "700" },
  body: { fontSize: 17, lineHeight: 26, fontWeight: "400" },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" }
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
};

export function AppText({
  variant = "body",
  color,
  muted,
  style,
  selectable,
  ...props
}: AppTextProps) {
  const { colors } = useAppTheme();
  const isImportant = variant !== "label" && variant !== "caption";

  return (
    <Text
      selectable={selectable ?? isImportant}
      style={[variants[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]}
      {...props}
    />
  );
}
