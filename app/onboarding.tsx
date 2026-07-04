import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { ChoiceChips } from "@/components/choice-chips";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { radius, spacing } from "@/constants/theme";
import { formatShortDate } from "@/lib/format";
import { useApp, type OnboardingInput } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";
import type { Gender, Language } from "@/types/models";

const languages = ["English", "Hindi", "Telugu"] as const;
const genders = ["Female", "Male", "Prefer not to say"] as const;

export default function OnboardingScreen() {
  const { isAuthenticated, completeOnboarding } = useApp();
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>();
  const [language, setLanguage] = useState<Language>("English");
  const [dob, setDob] = useState(new Date(1985, 0, 1, 12));
  const [birthTime, setBirthTime] = useState(new Date(1985, 0, 1, 7, 30));
  const [birthPlace, setBirthPlace] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [notificationTime, setNotificationTime] = useState(new Date(1985, 0, 1, 6, 0));
  const [showDob, setShowDob] = useState(false);
  const [showBirthTime, setShowBirthTime] = useState(false);
  const [showNotificationTime, setShowNotificationTime] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated]);

  const timeText = useMemo(
    () => birthTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    [birthTime]
  );
  const notificationText = useMemo(
    () => notificationTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    [notificationTime]
  );

  function validate() {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your full name.";
    if (!birthPlace.trim()) next.birthPlace = "Birth place is required for an accurate chart.";
    if (dob > new Date()) next.dob = "Date of birth cannot be in the future.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setLoading(true);
    try {
      const input: OnboardingInput = {
        fullName: name.trim(),
        gender,
        language,
        dateOfBirth: formatShortDate(dob),
        timeOfBirth: `${String(birthTime.getHours()).padStart(2, "0")}:${String(birthTime.getMinutes()).padStart(2, "0")}`,
        birthPlace: birthPlace.trim(),
        currentCity: currentCity.trim() || undefined,
        notificationTime: `${String(notificationTime.getHours()).padStart(2, "0")}:${String(notificationTime.getMinutes()).padStart(2, "0")}`
      };
      await completeOnboarding(input);
      router.replace("/home");
    } catch (caught) {
      setErrors({ submit: caught instanceof Error ? caught.message : "Your profile could not be saved." });
    } finally {
      setLoading(false);
    }
  }

  const pickerButton = (label: string, value: string, onPress: () => void, error?: string) => (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => ({
          minHeight: 54,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.maroon : colors.border,
          opacity: pressed ? 0.78 : 1
        })}
      >
        <AppText>{value}</AppText>
        <AppIcon name="calendar" size={20} color={colors.primary} />
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
      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">Let’s prepare your guidance</AppText>
        <AppText muted>
          Exact birth details help determine your Rashi, Nakshatra and Lagna using the Vedic sidereal system.
        </AppText>
      </View>

      <Card tone="blue">
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <AppIcon name="shield" size={24} color={colors.secondary} />
          <AppText variant="caption" style={{ flex: 1 }}>
            Your birth data is private and is used only to generate your horoscope.
          </AppText>
        </View>
      </Card>

      <Card>
        <FormField label="Full name" placeholder="As you prefer to see it" value={name} onChangeText={setName} error={errors.name} />
        <ChoiceChips label="Gender (optional)" options={genders} value={gender} onChange={setGender} />
        {pickerButton("Date of birth", dob.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), () => setShowDob(true), errors.dob)}
        {showDob && (
          <DateTimePicker
            value={dob}
            mode="date"
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
            onChange={(_, selected) => {
              if (process.env.EXPO_OS !== "ios") setShowDob(false);
              if (selected) setDob(selected);
            }}
          />
        )}
        {pickerButton("Exact time of birth", timeText, () => setShowBirthTime(true))}
        {showBirthTime && (
          <DateTimePicker
            value={birthTime}
            mode="time"
            minuteInterval={1}
            onChange={(_, selected) => {
              if (process.env.EXPO_OS !== "ios") setShowBirthTime(false);
              if (selected) setBirthTime(selected);
            }}
          />
        )}
        <AppText variant="caption" muted>
          Exact time is required for a reliable Lagna. Check a birth record if you are unsure.
        </AppText>
        <FormField
          label="Birth place"
          placeholder="City, state, country"
          value={birthPlace}
          onChangeText={setBirthPlace}
          error={errors.birthPlace}
          autoCapitalize="words"
        />
        <FormField
          label="Current city (optional)"
          placeholder="For local Panchang timings"
          value={currentCity}
          onChangeText={setCurrentCity}
          autoCapitalize="words"
        />
      </Card>

      <Card>
        <ChoiceChips label="Preferred language" options={languages} value={language} onChange={setLanguage} />
        {pickerButton("Daily reminder time", notificationText, () => setShowNotificationTime(true))}
        {showNotificationTime && (
          <DateTimePicker
            value={notificationTime}
            mode="time"
            minuteInterval={5}
            onChange={(_, selected) => {
              if (process.env.EXPO_OS !== "ios") setShowNotificationTime(false);
              if (selected) setNotificationTime(selected);
            }}
          />
        )}
        <AppText variant="caption" muted>
          We will ask notification permission later. The default is 6:00 AM.
        </AppText>
      </Card>

      {errors.submit ? (
        <AppText color={colors.maroon} style={{ textAlign: "center" }}>
          {errors.submit}
        </AppText>
      ) : null}
      <AppButton label="Create my Vedic profile" icon="sparkle" onPress={save} loading={loading} />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        By continuing, you agree to the Terms of Use and Privacy Policy.
      </AppText>
    </Screen>
  );
}
