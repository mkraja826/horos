import React from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "@/components/app-text";
import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ label, error, hint, style, ...props }: FormFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        style={[
          {
            minHeight: 54,
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: error ? colors.maroon : colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: 17
          },
          style
        ]}
        {...props}
      />
      {error ? (
        <AppText variant="caption" color={colors.maroon} selectable>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted selectable>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
