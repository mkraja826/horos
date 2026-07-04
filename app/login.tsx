import { router } from "expo-router";
import React, { useState } from "react";
import { Keyboard, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { ChoiceChips } from "@/components/choice-chips";
import { FormField } from "@/components/form-field";
import { IconBadge } from "@/components/icon-badge";
import { Screen } from "@/components/screen";
import { spacing } from "@/constants/theme";
import { useApp } from "@/providers/app-provider";
import { useAppTheme } from "@/providers/theme-provider";

type LoginMethod = "Phone" | "Email";

export default function LoginScreen() {
  const { requestOtp, verifyOtp, isApiConfigured } = useApp();
  const { colors } = useAppTheme();
  const [method, setMethod] = useState<LoginMethod>("Phone");
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedIdentifier = method === "Phone" ? identifier.replace(/\s/g, "") : identifier.trim().toLowerCase();

  async function continueLogin() {
    setError("");
    if (method === "Phone" && !/^\+?[0-9]{10,14}$/.test(normalizedIdentifier)) {
      setError("Enter a valid phone number, including country code when needed.");
      return;
    }
    if (method === "Email" && !/^\S+@\S+\.\S+$/.test(normalizedIdentifier)) {
      setError("Enter a valid email address.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const response = await requestOtp(normalizedIdentifier);
      setChallengeId(response.challengeId);
      setDevOtp(response.devOtp);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send the verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmOtp() {
    if (!challengeId || otp.length < 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyOtp(normalizedIdentifier, challengeId, otp);
      router.replace("/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be verified.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
        <IconBadge name="shield" size={62} tone="blue" />
        <AppText variant="title" style={{ textAlign: "center" }}>
          {challengeId ? "Enter your code" : "Welcome back"}
        </AppText>
        <AppText muted style={{ textAlign: "center" }}>
          {challengeId
            ? `We sent a verification code to ${normalizedIdentifier}.`
            : "Sign in securely. Your trial and birth profile stay linked to this account."}
        </AppText>
      </View>

      <Card>
        {!challengeId ? (
          <>
            <ChoiceChips label="Sign in with" options={["Phone", "Email"] as const} value={method} onChange={setMethod} />
            <FormField
              label={method === "Phone" ? "Mobile number" : "Email address"}
              placeholder={method === "Phone" ? "+91 98765 43210" : "you@example.com"}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={method === "Phone" ? "phone-pad" : "email-address"}
              autoCapitalize="none"
              autoComplete={method === "Phone" ? "tel" : "email"}
              error={error || undefined}
              returnKeyType="done"
              onSubmitEditing={continueLogin}
            />
            <AppButton label="Send verification code" onPress={continueLogin} loading={loading} />
          </>
        ) : (
          <>
            <FormField
              label="6-digit code"
              placeholder="••••••"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              error={error || undefined}
              style={{ textAlign: "center", fontSize: 24, letterSpacing: 8, fontVariant: ["tabular-nums"] }}
            />
            {(devOtp || !isApiConfigured) && (
              <View style={{ backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: 12 }}>
                <AppText variant="caption" color={colors.primary} style={{ textAlign: "center" }}>
                  Preview code: {devOtp ?? "123456"}
                </AppText>
              </View>
            )}
            <AppButton label="Verify and continue" onPress={confirmOtp} loading={loading} />
            <AppButton
              label="Use a different number or email"
              variant="ghost"
              onPress={() => {
                setChallengeId(null);
                setOtp("");
                setError("");
              }}
            />
          </>
        )}
      </Card>

      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        We use your contact only for secure sign-in and account support. We do not sell personal data.
      </AppText>
    </Screen>
  );
}
