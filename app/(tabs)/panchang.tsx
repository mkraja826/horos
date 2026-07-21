import React from "react";
import { View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { IconBadge } from "@/components/icon-badge";
import { PremiumLock } from "@/components/premium-lock";
import { LoadingCard, QueryError } from "@/components/query-state";
import { Screen } from "@/components/screen";
import { radius, spacing } from "@/constants/theme";
import { formatLongDate } from "@/lib/format";
import { usePanchang } from "@/hooks/use-vedic-data";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function PanchangScreen() {
  const { subscription } = useApp();
  const { colors } = useAppTheme();
  const panchang = usePanchang();

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Today’s Panchang</AppText>
        <AppText muted>{formatLongDate()}</AppText>
      </View>

      {!subscription.isPremium ? (
        <PremiumLock />
      ) : panchang.isLoading ? (
        <LoadingCard label="Calculating JPL-backed timings…" />
      ) : panchang.isError || !panchang.data ? (
        <QueryError onRetry={() => panchang.refetch()} />
      ) : (
        <>
          <Card tone="blue">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <IconBadge name="calendar" tone="blue" />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{panchang.data.location}</AppText>
                <AppText variant="caption" muted>
                  Timings currently use the saved birth-place coordinates and timezone.
                </AppText>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[
              ...(panchang.data.vara ? [["Vara", panchang.data.vara]] : []),
              ["Tithi", panchang.data.tithi],
              ["Nakshatra", panchang.data.nakshatra],
              ["Yoga", panchang.data.yoga],
              ["Karana", panchang.data.karana],
            ].map(([label, value]) => (
              <Card key={label} style={{ width: "48%", flexGrow: 1, minHeight: 92, padding: spacing.md }}>
                <AppText variant="caption" muted>{label}</AppText>
                <AppText variant="label">{value}</AppText>
              </Card>
            ))}
          </View>

          <Card style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
              <AppIcon name="sunrise" size={27} color={colors.gold} />
              <AppText variant="caption" muted>Sunrise</AppText>
              <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>{panchang.data.sunrise}</AppText>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
              <AppIcon name="sunset" size={27} color={colors.primary} />
              <AppText variant="caption" muted>Sunset</AppText>
              <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>{panchang.data.sunset}</AppText>
            </View>
          </Card>

          {[panchang.data.rahuKalam, panchang.data.yamagandam, panchang.data.gulikaKalam, panchang.data.auspiciousPeriod].some(Boolean) ? (
            <Card style={{ gap: 0 }}>
              {[
                ["Rahu Kalam", panchang.data.rahuKalam, colors.maroon],
                ["Yamagandam", panchang.data.yamagandam, colors.warning],
                ["Gulika Kalam", panchang.data.gulikaKalam, colors.textMuted],
                ["Auspicious period", panchang.data.auspiciousPeriod, colors.success],
              ].filter(([, value]) => Boolean(value)).map(([label, value, tint], index, all) => (
                <View
                  key={label}
                  style={{
                    paddingVertical: spacing.md,
                    borderBottomWidth: index < all.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: tint }} />
                  <AppText variant="label" style={{ flex: 1 }}>{label}</AppText>
                  <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>{value}</AppText>
                </View>
              ))}
            </Card>
          ) : null}

          <Card tone="warm">
            <AppText variant="label">Calculation method</AppText>
            <AppText muted>
              Skyfield with JPL DE440s, Lahiri Chitrapaksha, and geometric solar-centre sunrise/sunset without atmospheric refraction.
            </AppText>
          </Card>
        </>
      )}

      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Confirm ceremonial observances with a qualified local practitioner because almanac conventions may differ.
      </AppText>
    </Screen>
  );
}
