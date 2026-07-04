import React from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { spacing } from "@/constants/theme";

type SectionCardProps = {
  title: string;
  icon: string;
  children: React.ReactNode;
};

export function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconBadge name={icon} />
        <AppText variant="heading" style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      {children}
    </Card>
  );
}
