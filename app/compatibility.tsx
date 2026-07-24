import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { ChoiceChips } from "@/components/choice-chips";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { radius, spacing } from "@/constants/theme";
import { ApiError, api } from "@/lib/api-client";
import { isPhase4CompatibilityUiEnabled } from "@/lib/feature-flags";
import { formatShortDate } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";
import type {
  CompatibilityRequest,
  TraditionalCompatibilityRole,
} from "@/types/models";

const roleOptions = ["Not specified", "Bride", "Groom"] as const;
type RoleOption = (typeof roleOptions)[number];

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function compatibilityRoles(subject: RoleOption): {
  subjectRole: TraditionalCompatibilityRole;
  partnerRole: TraditionalCompatibilityRole;
} {
  if (subject === "Bride") return { subjectRole: "bride", partnerRole: "groom" };
  if (subject === "Groom") return { subjectRole: "groom", partnerRole: "bride" };
  return { subjectRole: "unspecified", partnerRole: "unspecified" };
}

export default function CompatibilityScreen() {
  const { isAuthenticated, profile, subscription } = useApp();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [dob, setDob] = useState(new Date(1990, 0, 1, 12));
  const [birthTime, setBirthTime] = useState(new Date(1990, 0, 1, 7, 30));
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("0");
  const [subjectRole, setSubjectRole] = useState<RoleOption>("Not specified");
  const [picker, setPicker] = useState<"date" | "birth" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isPhase4CompatibilityUiEnabled) router.replace("/home");
    else if (!isAuthenticated) router.replace("/welcome");
    else if (!profile) router.replace("/onboarding");
  }, [isAuthenticated, profile]);

  const report = useMutation({
    mutationFn: (payload: CompatibilityRequest) => api.compatibilityReport(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["compatibility-report", "active"], data);
      router.push("/compatibility-report");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 402) {
        router.push("/subscription");
        return;
      }
      setErrors({
        submit: error instanceof Error
          ? error.message
          : "The Kundli comparison could not be generated.",
      });
    },
  });

  if (!isPhase4CompatibilityUiEnabled || !profile) return <Screen />;

  function validate() {
    const next: Record<string, string> = {};
    const lat = Number(latitude);
    const lon = Number(longitude);
    const alt = Number(altitude || "0");
    if (!validTimezone(timezone.trim())) {
      next.timezone = "Use an IANA timezone such as Asia/Kolkata.";
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      next.latitude = "Latitude must be between -90 and 90.";
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      next.longitude = "Longitude must be between -180 and 180.";
    }
    if (!Number.isFinite(alt) || alt < -500 || alt > 10000) {
      next.altitude = "Altitude must be between -500 and 10,000 metres.";
    }
    if (dob > new Date()) next.dob = "Date of birth cannot be in the future.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function generateReport() {
    if (!subscription.isPremium) {
      router.push("/subscription");
      return;
    }
    if (!validate()) return;
    setErrors({});
    const roles = compatibilityRoles(subjectRole);
    report.mutate({
      partnerBirth: {
        dateOfBirth: formatShortDate(dob),
        timeOfBirth: `${String(birthTime.getHours()).padStart(2, "0")}:${String(
          birthTime.getMinutes()
        ).padStart(2, "0")}`,
        timezone: timezone.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        altitudeMeters: Number(altitude || "0"),
      },
      ...roles,
    });
  }

  const pickerButton = (
    label: string,
    value: string,
    kind: typeof picker,
    error?: string
  ) => (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setPicker(kind)}
        style={({ pressed }) => ({
          minHeight: 54,
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.maroon : colors.border,
          opacity: pressed ? 0.78 : 1,
        })}
      >
        <AppText>{value}</AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" color={colors.maroon}>
          {error}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Kundli compatibility</AppText>
        <AppText muted>
          Compare your saved birth chart with one partner using the traditional Ashtakoota
          framework.
        </AppText>
      </View>

      <Card tone="warm">
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <AppIcon name="shield" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="label">Private by design</AppText>
            <AppText muted>
              Partner details are used only for this calculation. They are not saved to the
              profile or device storage.
            </AppText>
          </View>
        </View>
      </Card>

      <Card>
        <AppText variant="heading">Partner birth details</AppText>
        {pickerButton("Date of birth", dob.toLocaleDateString("en-IN"), "date", errors.dob)}
        {pickerButton(
          "Exact time of birth",
          birthTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
          "birth"
        )}
        <FormField
          label="Birth timezone"
          placeholder="Asia/Kolkata"
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.timezone}
          hint="Use the timezone at the partner’s birth place."
        />
        <FormField
          label="Birth latitude"
          placeholder="17.385"
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numbers-and-punctuation"
          error={errors.latitude}
        />
        <FormField
          label="Birth longitude"
          placeholder="78.487"
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numbers-and-punctuation"
          error={errors.longitude}
        />
        <FormField
          label="Altitude in metres (optional)"
          value={altitude}
          onChangeText={setAltitude}
          keyboardType="numbers-and-punctuation"
          error={errors.altitude}
          hint="Coordinates can be copied from a maps app."
        />
      </Card>

      <Card>
        <ChoiceChips
          label="Your traditional role (optional)"
          options={roleOptions}
          value={subjectRole}
          onChange={setSubjectRole}
        />
        <AppText muted>
          Bride or groom roles enable the complete 36-point traditional calculation. Choosing
          “Not specified” keeps the comparison role-neutral and reports only the supported
          27-point coverage.
        </AppText>
      </Card>

      {picker === "date" ? (
        <DateTimePicker
          value={dob}
          mode="date"
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
          onChange={(_, value) => {
            setPicker(null);
            if (value) setDob(value);
          }}
        />
      ) : null}
      {picker === "birth" ? (
        <DateTimePicker
          value={birthTime}
          mode="time"
          minuteInterval={1}
          onChange={(_, value) => {
            setPicker(null);
            if (value) setBirthTime(value);
          }}
        />
      ) : null}

      {errors.submit ? <AppText color={colors.maroon}>{errors.submit}</AppText> : null}
      <AppButton
        label={subscription.isPremium ? "Generate compatibility report" : "Unlock compatibility"}
        icon={subscription.isPremium ? "sparkle" : "crown"}
        onPress={generateReport}
        loading={report.isPending}
      />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Traditional astrology guidance for reflection. This report does not predict relationship
        or marriage success.
      </AppText>
    </Screen>
  );
}
