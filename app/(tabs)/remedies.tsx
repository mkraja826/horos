import React from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { PremiumLock } from "@/components/premium-lock";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { useApp } from "@/providers/app-provider";

const remedies = [
  { icon: "flame", title: "Light a diya", text: "Begin the day with a small lamp and one quiet intention for your family." },
  { icon: "handHeart", title: "Offer simple charity", text: "Share food, time or practical help according to your means—never from pressure." },
  { icon: "family", title: "Respect elders", text: "A patient call or kind practical gesture can itself become a meaningful remedy." },
  { icon: "leaf", title: "Care for living beings", text: "Feed birds or animals safely, or care for a plant in your home." },
  { icon: "moon", title: "Sit in silence", text: "Take five minutes for slow breathing without trying to solve anything." },
  { icon: "sparkle", title: "Mantra practice", text: "Chant “Om Namah Shivaya” 11 times with an easy, unhurried breath." }
];

export default function RemediesScreen() {
  const { subscription } = useApp();
  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Simple remedies</AppText>
        <AppText muted>Safe, affordable practices for steadiness and reflection.</AppText>
      </View>

      {!subscription.isPremium ? (
        <PremiumLock />
      ) : (
        remedies.map((item) => (
          <Card key={item.title}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <IconBadge name={item.icon} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="heading">{item.title}</AppText>
                <AppText muted>{item.text}</AppText>
              </View>
            </View>
          </Card>
        ))
      )}

      <Card tone="blue">
        <AppText variant="label">Our remedy promise</AppText>
        <AppText muted>
          We never pressure you to buy gemstones, rituals or consultations. A remedy should be safe, simple and comfortable for your beliefs and budget.
        </AppText>
      </Card>
    </Screen>
  );
}
