# Supabase Astro migration

## Project boundary

This application uses only the Supabase project named `Astro`:

```text
project ref: hdaugtypjpniesdgyral
project URL: https://hdaugtypjpniesdgyral.supabase.co
```

The MDMS project is outside this application's scope and must never be used by Horos migrations, Edge Functions, mobile environment variables, or operational scripts.

## Architecture

```text
Expo mobile app
  -> /functions/v1/horos-api
     -> Supabase Auth
     -> Astro Postgres tables with RLS
     -> JPL-only Astro FastAPI
```

The mobile API route names remain compatible with the earlier Cloudflare Worker contract. This lets the app migrate without rewriting every screen and hook.

## Authentication

`horos-api` wraps Supabase email/phone OTP so the existing two-step login screen can remain:

- `POST /auth/login` with `identifier` requests the OTP.
- `POST /auth/login` with `identifier` and `otp` verifies it.
- `POST /auth/refresh` rotates the Supabase session.

The Expo client stores access and refresh tokens in SecureStore and retries one failed authenticated request after refreshing the session.

For email codes, the Supabase email template must display `{{ .Token }}`. Phone OTP requires a configured SMS provider in the Astro Supabase project.

## Database

The committed migrations create:

- `profiles`
- `birth_details`
- `horoscope_cache`
- `subscriptions`
- `notifications`
- `trial_ledger`
- `webhook_events`
- `app_settings`

User-owned tables use `auth.users` UUIDs and row-level security. Trial claims are atomic through `claim_horos_trial_v1`. Raw phone numbers and email addresses are not stored in application tables.

## Astrology provider

The Edge Function calls the separate Python service using:

```text
ASTRO_API_URL
ASTRO_API_KEY (optional)
```

The required provider is the `mkraja826/Astro` FastAPI service with calculation profile:

```text
south_indian_drik_lahiri_jpl_de440s_v1
```

No Swiss Ephemeris fallback is allowed. Profile creation returns a service error when the JPL provider is missing or unavailable.

Birth input requires:

- local birth date
- exact local birth time
- IANA birth timezone
- latitude
- longitude
- optional altitude

The app must not replace the birth timezone with the phone's current timezone and must not invent coordinates from a place name.

## Interpretation boundary

Birth chart and Panchanga fields are calculated by the JPL provider. Daily, weekly and monthly text remains explicitly labelled `editorial` until a separately validated transit and interpretation engine exists. Editorial guidance must not be presented as a planetary prediction.

## Edge Function deployment

Function name:

```text
horos-api
```

The function uses custom route-level authentication because `/auth/login`, `/auth/refresh`, and the RevenueCat webhook have different authentication requirements. Deploy with Supabase gateway JWT verification disabled and keep the function's own `requireUser()` checks enabled.

Required secrets/configuration:

```text
ASTRO_API_URL
ASTRO_API_KEY                  optional
ENVIRONMENT                    production for release
ALLOWED_ORIGINS                comma-separated web origins
REVENUECAT_SECRET_KEY          before paid verification
REVENUECAT_WEBHOOK_SECRET      before enabling webhook
REVENUECAT_ENTITLEMENT_ID      defaults to premium
```

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function.

## Mobile environment

```text
EXPO_PUBLIC_API_URL=https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api
EXPO_PUBLIC_ALLOW_DEMO_DATA=false
```

The URL and project ref are public identifiers. Never place the service-role key, RevenueCat secret, OTP provider credentials, or Astro API secret in an `EXPO_PUBLIC_` variable.

## Cutover checklist

1. Deploy the Python Astro API with `de440s.bsp` mounted.
2. Set `ASTRO_API_URL` on the Astro Supabase project.
3. Configure email-token template and/or phone SMS provider.
4. Deploy `horos-api` with `verify_jwt=false`.
5. Test OTP, refresh, profile creation, chart, Panchanga and deletion.
6. Configure RevenueCat secrets and webhook.
7. Build the Expo app with the Supabase function URL.
8. Remove the Cloudflare Worker/D1 runtime only after production smoke tests pass.
