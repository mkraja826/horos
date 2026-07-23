# Horos Private-Beta Android Build

This runbook creates a production-like Android APK for a very small private-beta group. It does not publish to Google Play and it does not change the hosted Horos backend.

## Safety boundary

Never commit or paste into issue comments, screenshots, logs, or chat:

- Expo access tokens;
- Android signing credentials or keystores;
- RevenueCat server or webhook secrets;
- Supabase secret or service-role keys;
- Astro API credentials;
- OTPs, access tokens, or refresh tokens.

The mobile build may contain only public client configuration. Values with an `EXPO_PUBLIC_` prefix are readable from the installed application and must not be treated as secrets.

## Build profile

The `private-beta` profile in `eas.json` is intentionally configured as:

- EAS environment: `production`;
- distribution: `internal`;
- Android artifact: installable APK;
- hosted API: the Horos Supabase Edge Function;
- application environment: `production`;
- demo data: disabled.

The EAS project ID and RevenueCat public SDK keys remain external EAS project variables and are not committed.

## 1. Prepare the local repository

Use the pinned toolchain where possible:

```powershell
cd C:\horos
git checkout main
git pull
npm ci
npm run typecheck
npm run lint
powershell -ExecutionPolicy Bypass -File .\scripts\audit-hosted-deployment-readiness.ps1
```

The working tree must remain clean before the build.

## 2. Sign in and confirm the EAS project

Run:

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
```

If the repository is not linked to the intended EAS project, run the interactive initializer once:

```powershell
npx eas-cli@latest init
```

Record the returned EAS project ID in the approved local secret/configuration location. Do not commit it unless the release policy is deliberately changed.

For the current PowerShell session, expose it only as a public build variable:

```powershell
$env:EXPO_PUBLIC_EAS_PROJECT_ID = "YOUR-EAS-PROJECT-ID"
```

## 3. Configure EAS production variables

Create or update these project-scoped variables in the EAS `production` environment:

```text
EXPO_PUBLIC_EAS_PROJECT_ID
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
EXPO_PUBLIC_REVENUECAT_IOS_KEY
```

Use `plaintext` or `sensitive` visibility. Do not use secret visibility for values that must be embedded in the client bundle.

Example command shape:

```powershell
npx eas-cli@latest env:create `
  --name EXPO_PUBLIC_EAS_PROJECT_ID `
  --value "YOUR-EAS-PROJECT-ID" `
  --environment production `
  --visibility plaintext `
  --scope project
```

Repeat for each RevenueCat public SDK key, using the exact platform key from the approved RevenueCat project. Never substitute a RevenueCat server key or webhook authorization value.

Verify variable names without printing sensitive values:

```powershell
npx eas-cli@latest env:list --environment production --scope project
```

## 4. Resolve and inspect the build configuration

Run:

```powershell
npx eas-cli@latest config `
  --platform android `
  --profile private-beta
```

Confirm the resolved configuration shows:

```text
Android package: com.dailyvedicastro.app
Build profile: private-beta
Distribution: internal
Build type: apk
EXPO_PUBLIC_APP_ENV: production
EXPO_PUBLIC_ALLOW_DEMO_DATA: false
EXPO_PUBLIC_API_URL: https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api
```

Stop if the project ID, package, API URL, app environment, or demo-data flag differs.

## 5. Create the internal APK

Run:

```powershell
npx eas-cli@latest build `
  --platform android `
  --profile private-beta
```

Allow EAS to create or reuse the approved Android signing credential. Never download, expose, or replace an existing keystore without a deliberate signing-key review.

The successful build produces an internal-distribution URL and an APK that can be installed directly on an Android device. Do not submit this APK to Google Play.

## 6. Device acceptance smoke

Install the APK on one approved test device and verify, in order:

1. The app launches without a Metro development server.
2. No demo profile, demo horoscope, or fallback mock data appears.
3. OTP request and six-digit OTP verification succeed.
4. Exact birth details can be saved and reloaded.
5. The first eligible test identifier receives one trial.
6. Birth chart and Panchang return hosted provider results.
7. Daily, weekly, and monthly readings load during the trial.
8. Closing and reopening the application preserves or refreshes the session correctly.
9. Notification permission is requested only through the intended user action.
10. Account deletion signs the user out and invalidates the old session.

Use only disposable private-beta identifiers for destructive tests. Redact identifiers and all authentication material from evidence.

## 7. Distribution rule

Share the EAS internal-distribution URL only with the approved private-beta group. Do not post it publicly and do not claim public availability.

Before widening the group, record:

- build ID and creation time;
- Git commit SHA;
- Android package and app version;
- hosted API health result;
- tester device model and Android version;
- redacted pass/fail results for the device smoke.

## Rollback

If the installed build regresses authentication, profile persistence, provider calls, entitlements, or deletion:

1. Stop distributing the build URL.
2. Remove the build from the private-beta instructions.
3. Keep the previous known-good APK available to current testers.
4. Do not roll back the database or Edge Function blindly.
5. Fix the mobile issue on a new branch and rerun repository CI, hosted acceptance where relevant, and the device smoke before redistributing.
