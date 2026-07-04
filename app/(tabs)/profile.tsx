import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppIcon } from "@/components/app-icon";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { ChoiceChips } from "@/components/choice-chips";
import { FormField } from "@/components/form-field";
import { IconBadge } from "@/components/icon-badge";
import { Screen } from "@/components/screen";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { radius, spacing, type ThemeMode } from "@/constants/theme";
import { disableGuidanceNotifications, enableGuidanceNotifications } from "@/lib/notifications";
import { initials } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";
import type { Language } from "@/types/models";

const languages = ["English", "Hindi", "Telugu"] as const;
const themeModes = ["System", "Light", "Dark"] as const;

export default function ProfileScreen() {
  const { profile, updateProfile, logout, deleteAccount } = useApp();
  const { colors, mode, setMode } = useAppTheme();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile?.fullName ?? "");
  const [notificationError, setNotificationError] = useState("");
  const [working, setWorking] = useState(false);

  if (!profile) return <Screen />;
  const currentProfile = profile;

  async function saveName() {
    if (name.trim().length < 2) return;
    setWorking(true);
    try {
      await updateProfile({ fullName: name.trim() });
      setEditingName(false);
    } finally {
      setWorking(false);
    }
  }

  async function changeNotifications(enabled: boolean) {
    setNotificationError("");
    try {
      if (enabled) await enableGuidanceNotifications(currentProfile.notificationTime);
      else await disableGuidanceNotifications();
      await updateProfile({ notificationsEnabled: enabled });
    } catch (caught) {
      setNotificationError(caught instanceof Error ? caught.message : "Notification settings could not be changed.");
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, birth details, notification token and subscription record from our service. Store subscriptions should be cancelled separately in Apple or Google settings.",
      [
        { text: "Keep account", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await deleteAccount();
              router.replace("/welcome");
            } catch (caught) {
              Alert.alert("Could not delete account", caught instanceof Error ? caught.message : "Please try again.");
            } finally {
              setWorking(false);
            }
          }
        }
      ]
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md }}>
        <View
          style={{ width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}
        >
          <AppText variant="title" color="#FFF8E9">{initials(profile.fullName)}</AppText>
        </View>
        <AppText variant="title">{profile.fullName}</AppText>
        <AppText muted>{profile.identifier}</AppText>
      </View>

      <SubscriptionBanner />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconBadge name="profile" />
          <AppText variant="heading" style={{ flex: 1 }}>Personal details</AppText>
          {!editingName ? (
            <Pressable onPress={() => setEditingName(true)}>
              <AppText variant="label" color={colors.primary} selectable={false}>Edit</AppText>
            </Pressable>
          ) : null}
        </View>
        {editingName ? (
          <>
            <FormField label="Full name" value={name} onChangeText={setName} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><AppButton label="Cancel" variant="ghost" onPress={() => { setName(profile.fullName); setEditingName(false); }} /></View>
              <View style={{ flex: 1 }}><AppButton label="Save" onPress={saveName} loading={working} /></View>
            </View>
          </>
        ) : (
          <>
            <InfoRow label="Birth date" value={profile.birth.dateOfBirth} />
            <InfoRow label="Birth time" value={profile.birth.timeOfBirth} />
            <InfoRow label="Birth place" value={profile.birth.birthPlace} />
            <InfoRow label="Rashi · Nakshatra" value={`${profile.rashi} · ${profile.nakshatra}`} last />
          </>
        )}
      </Card>

      <Card>
        <ChoiceChips
          label="Language"
          options={languages}
          value={profile.language}
          onChange={(language: Language) => updateProfile({ language })}
        />
        <ChoiceChips
          label="Appearance"
          options={themeModes}
          value={(mode[0].toUpperCase() + mode.slice(1)) as (typeof themeModes)[number]}
          onChange={(value) => setMode(value.toLowerCase() as ThemeMode)}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconBadge name="bell" />
          <View style={{ flex: 1 }}>
            <AppText variant="label">Guidance reminders</AppText>
            <AppText variant="caption" muted>Every day at {profile.notificationTime}</AppText>
          </View>
          <Switch
            value={profile.notificationsEnabled}
            onValueChange={changeNotifications}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        {notificationError ? <AppText variant="caption" color={colors.maroon}>{notificationError}</AppText> : null}
      </Card>

      <Card>
        <MenuRow icon="crown" label="Manage subscription" onPress={() => router.push("/subscription")} />
        <MenuRow icon="shield" label="Privacy policy" onPress={() => router.push("/privacy")} />
        <MenuRow icon="book" label="Terms of use" onPress={() => router.push("/terms")} last />
      </Card>

      <AppButton
        label="Log out"
        variant="ghost"
        icon="logout"
        onPress={async () => {
          await logout();
          router.replace("/welcome");
        }}
      />
      <AppButton label="Delete account" variant="danger" icon="trash" onPress={confirmDelete} disabled={working} />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>Daily Vedic Astro · Version 1.0.0</AppText>
    </Screen>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, gap: 3 }}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

function MenuRow({ icon, label, onPress, last = false }: { icon: string; label: string; onPress: () => void; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.68 : 1
      })}
    >
      <AppIcon name={icon} size={21} color={colors.primary} />
      <AppText variant="label" style={{ flex: 1 }}>{label}</AppText>
      <AppIcon name="chevron" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
