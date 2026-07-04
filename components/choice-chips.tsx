import React from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { radius, spacing } from "@/constants/theme";
import { useAppTheme } from "@/providers/theme-provider";

type ChoiceChipsProps<T extends string> = {
  label: string;
  options: readonly T[];
  value?: T;
  onChange: (value: T) => void;
};

export function ChoiceChips<T extends string>({ label, options, value, onChange }: ChoiceChipsProps<T>) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.lg,
                paddingVertical: 11,
                minHeight: 44,
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.75 : 1
              })}
            >
              <AppText variant="label" selectable={false} color={selected ? colors.white : colors.text}>
                {option}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
