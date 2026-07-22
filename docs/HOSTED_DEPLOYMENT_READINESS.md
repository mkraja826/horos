# Horos Hosted Deployment Readiness

This document separates repository readiness from hosted cloud readiness. The audit and this runbook do not deploy anything, enable billing, create users, change Supabase secrets, or access the MDMS project.

## Intended production path

```text
Expo mobile app
    -> https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api
        -> hosted HTTPS Astro API
            -> Skyfield + JPL DE440s
            -> durable Astro usage metering in hdaugtypjpniesdgyral
```

The unrelated MDMS project must never appear in Horos deployment commands, configuration, secrets, or documentation.

## Static repository gate

Run from a clean Horos working tree:

```powershell
powershell -ExecutionPolicy Bypass `
  -File .\scripts\audit-hosted-deployment-readiness.ps1
```

The audit verifies:

- the mobile API URL is bound to the intended Horos Edge Function;
- demo data is disabled in checked-in and EAS production configuration;
- server-only credential names are absent from mobile code and public configuration;
- the blocked MDMS project reference is absent from tracked files;
- the active Edge Function references all required server environment variables;
- public OTP and RevenueCat webhook routes remain before the internal user-auth boundary;
- protected routes still use `requireUser`;
- production CORS allow-list logic exists;
- the Astro provider requires HTTPS in production;
- Astro consumer and request-ID headers are present;
- core RLS, atomic trial claim, and explicit service-only policies are committed;
- Supabase gateway JWT verification is pinned off for `horos-api` in `supabase/config.toml`.

Expected final output:

```text
Static repository readiness: PASS
Horos hosted-deployment readiness audit passed.
No cloud state was read or changed.
```

## Why gateway JWT verification is disabled

`horos-api` contains genuinely public routes:

- `GET /health`;
- `POST /auth/login` for OTP request and verification;
- `POST /auth/refresh`;
- `POST /subscription/webhook`, protected by the RevenueCat webhook secret.

The function then calls `requireUser` before profile, horoscope, chart, Panchang, subscription-status, subscription-verification, notification, and account routes. Gateway JWT verification must therefore be disabled for the function as a whole, while application-level authentication remains mandatory for protected routes.

The repository pins this behavior:

```toml
[functions.horos-api]
verify_jwt = false
```

Do not deploy with a conflicting CLI flag or dashboard setting.

## Required Edge Function environment variable names

Set these only in the Horos Supabase Edge Function environment. Do not place them in Expo variables, mobile code, screenshots, logs, documentation values, or Git.

Required:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ASTRO_API_URL
ASTRO_API_KEY
ENVIRONMENT
REVENUECAT_SECRET_KEY
REVENUECAT_WEBHOOK_SECRET
```

Conditional or optional:

```text
ALLOWED_ORIGINS
REVENUECAT_ENTITLEMENT_ID
```

Production rules:

```text
ENVIRONMENT=production
ASTRO_API_URL must use https://
ALLOWED_ORIGINS must contain only approved web origins when web access is enabled
REVENUECAT_ENTITLEMENT_ID defaults to premium when omitted
```

The Supabase platform-provided URL and keys must belong only to project `hdaugtypjpniesdgyral`. Never reuse the revoked legacy service-role JWT. Use only a current project secret stored through the Supabase secret manager.

## Required public mobile variables

These values are safe for the built mobile client but must be configured deliberately in EAS before a private-beta build:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_APP_ENV
EXPO_PUBLIC_ALLOW_DEMO_DATA
EXPO_PUBLIC_EAS_PROJECT_ID
EXPO_PUBLIC_REVENUECAT_IOS_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
```

Required production values and constraints:

```text
EXPO_PUBLIC_API_URL=https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_ALLOW_DEMO_DATA=false
```

The EAS project ID and RevenueCat public SDK keys remain external configuration gates. They are not server secrets, but they should not be guessed.

## Repository migrations

The minimum ordered migration set is:

```text
20260721060000_horos_core_schema_v1.sql
20260721062000_atomic_trial_claim_v1.sql
20260721063000_explicit_service_only_policies_v1.sql
```

Repository presence does not prove remote application. Before deployment, verify the migration history of only project `hdaugtypjpniesdgyral`. Do not apply or inspect migrations in any unrelated project.

Important controls:

- all user and service tables have RLS enabled;
- users may read or change only their own permitted records;
- `claim_horos_trial_v1` is executable only by `service_role`;
- `app_settings`, `trial_ledger`, and `webhook_events` explicitly deny `anon` and `authenticated` access;
- the Edge Function performs privileged writes with the server-only key.

## Deployment sequence — paused until explicit approval

Do not execute these hosted actions while cloud billing and deployment remain paused.

1. Select a supported host for the Astro container and obtain an HTTPS URL.
2. Deploy Astro using its protected secret-file configuration and pinned JPL checksum.
3. Run Astro hosted readiness and authenticated staging smoke.
4. Verify Horos migration history on project `hdaugtypjpniesdgyral`.
5. Set the Horos Edge Function environment variables by name without printing values.
6. Deploy only `horos-api` using the committed `supabase/config.toml`.
7. Verify public health, OTP request, and webhook authorization behavior.
8. Create a disposable private-beta user through the normal OTP flow.
9. Verify profile persistence, one-time trial claim, chart, Panchang, premium restrictions, refresh, and account deletion.
10. Configure EAS public production variables and build an internal Android artifact.
11. Invite a very small private-beta group before any public availability claim.

## Hosted end-to-end acceptance gate

A hosted private beta is not approved until one disposable user proves all of the following:

```text
OTP request -> OTP verification -> access token
profile create -> persisted exact birth data
trial claim -> trial active once only
birth chart -> provider mode with request ID
Panchang -> provider mode with request ID
weekly/monthly premium access -> allowed during trial
session refresh -> new valid session
account deletion -> auth and owned data removed
repeat sign-up with same identifier -> no second free trial
```

Logs and screenshots must redact phone numbers, email addresses, access tokens, refresh tokens, Supabase secrets, Astro API credentials, RevenueCat secrets, and raw webhook authorization.

## Rollback plan

If the hosted function fails after deployment:

1. Stop the private-beta test; do not broaden access.
2. Restore the previous known-good `horos-api` deployment.
3. Keep the mobile build pointed at the same function URL only when health and OTP gates pass.
4. Do not roll back irreversible database changes blindly; review migration effects first.
5. Rotate any credential that was exposed in logs or screenshots.
6. Re-run the static audit, CI, local private-beta preflight, hosted health, and disposable-user flow before resuming.

## Legacy Worker warning

The `worker/` directory and `worker:deploy` package script are legacy compatibility code. They are not the active Horos backend. Do not run the Worker deployment command during the Supabase private-beta rollout.
