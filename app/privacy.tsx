import React from "react";

import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";

export default function PrivacyScreen() {
  return (
    <Screen>
      <AppText variant="caption" muted>Effective 24 June 2026</AppText>
      <Card tone="blue">
        <AppText variant="heading">Your birth details are private</AppText>
        <AppText muted>
          Daily Vedic Astro uses your details to calculate and deliver your guidance. We do not sell your personal information.
        </AppText>
      </Card>
      <SectionCard title="Information we collect" icon="profile">
        <AppText muted>
          Contact information for sign-in; name, optional gender, date, exact time and place of birth; language, current city and reminder preference; app diagnostics; and subscription entitlement status. Store payment details remain with Apple or Google and are not stored by us.
        </AppText>
      </SectionCard>
      <SectionCard title="How it is used" icon="sparkle">
        <AppText muted>
          We use your information to authenticate your account, calculate your chart and Panchang, create horoscope guidance, remember your preferences, send reminders you request, prevent repeated trials and provide support.
        </AppText>
      </SectionCard>
      <SectionCard title="Storage and protection" icon="shield">
        <AppText muted>
          Data is sent over HTTPS. Session credentials and the local birth profile are kept in protected device storage. Backend access is restricted and secrets are never included in the app bundle. Horoscope caches are linked to an internal user identifier.
        </AppText>
      </SectionCard>
      <SectionCard title="Service providers" icon="settings">
        <AppText muted>
          We may use Cloudflare for hosting and database services, Expo for notifications, RevenueCat for store entitlement validation, and a configured astrology data provider. Each receives only the data needed to perform its service.
        </AppText>
      </SectionCard>
      <SectionCard title="Deletion and choices" icon="trash">
        <AppText muted>
          You can disable notifications, change preferences or delete your account from Profile. Account deletion removes your profile, birth details, notification tokens and service-side subscription record. It does not automatically cancel an Apple or Google subscription; cancel that in store settings.
        </AppText>
      </SectionCard>
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        Before store submission, replace the support placeholders in the README with the operating company name, postal address and privacy contact email.
      </AppText>
    </Screen>
  );
}
