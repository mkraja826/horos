import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton } from "@/components/app-button";
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

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export default function OnboardingScreen() {
  const { isAuthenticated, completeOnboarding } = useApp();
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>();
  const [language, setLanguage] = useState<Language>("English");
  const [dob, setDob] = useState(new Date(1985, 0, 1, 12));
  const [birthTime, setBirthTime] = useState(new Date(1985, 0, 1, 7, 30));
  const [birthPlace, setBirthPlace] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("0");
  const [currentCity, setCurrentCity] = useState("");
  const [notificationTime, setNotificationTime] = useState(new Date(1985, 0, 1, 6));
  const [picker, setPicker] = useState<"date" | "birth" | "notification" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated]);

  function validate() {
    const next: Record<string, string> = {};
    const lat = Number(latitude);
    const lon = Number(longitude);
    const alt = Number(altitude || "0");
    if (name.trim().length < 2) next.name = "Please enter your full name.";
    if (!birthPlace.trim()) next.birthPlace = "Birth place is required.";
    if (!validTimezone(timezone.trim())) next.timezone = "Use an IANA timezone such as Asia/Kolkata.";
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) next.latitude = "Latitude must be between -90 and 90.";
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) next.longitude = "Longitude must be between -180 and 180.";
    if (!Number.isFinite(alt) || alt < -500 || alt > 10000) next.altitude = "Altitude must be between -500 and 10,000 metres.";
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
        notificationTime: `${String(notificationTime.getHours()).padStart(2, "0")}:${String(notificationTime.getMinutes()).padStart(2, "0")}`,
        dateOfBirth: formatShortDate(dob),
        timeOfBirth: `${String(birthTime.getHours()).padStart(2, "0")}:${String(birthTime.getMinutes()).padStart(2, "0")}`,
        birthPlace: birthPlace.trim(),
        currentCity: currentCity.trim() || undefined,
        timezone: timezone.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        altitudeMeters: Number(altitude || "0"),
      };
      await completeOnboarding(input);
      router.replace("/home");
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Your profile could not be saved." });
    } finally {
      setLoading(false);
    }
  }

  const pickerButton = (label: string, value: string, kind: typeof picker, error?: string) => (
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
      {error ? <AppText variant="caption" color={colors.maroon}>{error}</AppText> : null}
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Create your Vedic profile</AppText>
        <AppText muted>Exact time, timezone and coordinates are required for the JPL-backed Lagna.</AppText>
      </View>

      <Card>
        <FormField label="Full name" value={name} onChangeText={setName} error={errors.name} />
        <ChoiceChips label="Gender (optional)" options={genders} value={gender} onChange={setGender} />
        {pickerButton("Date of birth", dob.toLocaleDateString("en-IN"), "date", errors.dob)}
        {pickerButton("Exact time of birth", birthTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), "birth")}
        <FormField label="Birth place" placeholder="City, state, country" value={birthPlace} onChangeText={setBirthPlace} error={errors.birthPlace} />
        <FormField
          label="Birth timezone"
          placeholder="Asia/Kolkata"
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.timezone}
          hint="Use the timezone at the birth place, not the phone’s current timezone."
        />
        <FormField label="Birth latitude" placeholder="16.575" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" error={errors.latitude} />
        <FormField label="Birth longitude" placeholder="79.312" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" error={errors.longitude} />
        <FormField label="Altitude in metres (optional)" value={altitude} onChangeText={setAltitude} keyboardType="numbers-and-punctuation" error={errors.altitude} hint="Coordinates can be copied from a maps app." />
        <FormField label="Current city (optional)" value={currentCity} onChangeText={setCurrentCity} />
      </Card>

      <Card>
        <ChoiceChips label="Preferred language" options={languages} value={language} onChange={setLanguage} />
        {pickerButton("Daily reminder time", notificationTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), "notification")}
      </Card>

      {picker === "date" ? (
        <DateTimePicker value={dob} mode="date" maximumDate={new Date()} minimumDate={new Date(1920, 0, 1)} onChange={(_, value) => { setPicker(null); if (value) setDob(value); }} />
      ) : null}
      {picker === "birth" ? (
        <DateTimePicker value={birthTime} mode="time" minuteInterval={1} onChange={(_, value) => { setPicker(null); if (value) setBirthTime(value); }} />
      ) : null}
      {picker === "notification" ? (
        <DateTimePicker value={notificationTime} mode="time" minuteInterval={5} onChange={(_, value) => { setPicker(null); if (value) setNotificationTime(value); }} />
      ) : null}

      {errors.submit ? <AppText color={colors.maroon}>{errors.submit}</AppText> : null}
      <AppButton label="Create my Vedic profile" icon="sparkle" onPress={save} loading={loading} />
    </Screen>
  );
}
