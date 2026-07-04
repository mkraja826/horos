import React from "react";

import { AppText } from "@/components/app-text";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";

export default function TermsScreen() {
  return (
    <Screen>
      <AppText variant="caption" muted>Effective 24 June 2026</AppText>
      <Card tone="warm">
        <AppText variant="heading">Guidance, not certainty</AppText>
        <AppText muted>
          This app provides astrology-based guidance for reflection and entertainment. It does not replace professional medical, legal, financial or personal advice.
        </AppText>
      </Card>
      <SectionCard title="Using the service" icon="book">
        <AppText muted>
          You must provide accurate account information and keep access to your sign-in method secure. Guidance depends on the birth details and location you provide. Astrology is interpretive, and we do not promise a particular outcome.
        </AppText>
      </SectionCard>
      <SectionCard title="Safety boundaries" icon="shield">
        <AppText muted>
          Do not use the app to make urgent health, safety, legal or investment decisions. We do not provide death or disease predictions, guaranteed marriage or financial outcomes, or pressure to purchase remedies.
        </AppText>
      </SectionCard>
      <SectionCard title="Trial and subscription" icon="crown">
        <AppText muted>
          A new account receives one 30-day service trial. It cannot be restarted by reinstalling. The optional premium plan costs ₹10 per month through Apple App Store or Google Play. Payment is charged to your store account and renews automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in your store account settings. Restore Purchase checks the same store account for an existing entitlement.
        </AppText>
      </SectionCard>
      <SectionCard title="Availability" icon="settings">
        <AppText muted>
          We aim to keep guidance available but may pause the service for maintenance, security or provider outages. Panchang and auspicious timings vary by location and calculation convention; ceremonial decisions should be confirmed with a trusted local practitioner.
        </AppText>
      </SectionCard>
      <SectionCard title="Account closure" icon="trash">
        <AppText muted>
          You may delete your account at any time. We may suspend abuse, attempts to bypass subscriptions or unlawful use. Terms and privacy contact details must be completed by the app operator before public store release.
        </AppText>
      </SectionCard>
    </Screen>
  );
}
