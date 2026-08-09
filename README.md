<div align="center">

# Horos

### Mobile Vedic astrology experience backed by protected deterministic calculations

An Expo / React Native application with a Supabase Edge Function backend, premium entitlements, notifications, profile management, and a protected connection to the Jyothisyam calculation service.

**Expo 56 · React Native 0.85 · TypeScript · Supabase · React Query · RevenueCat**

</div>

---

## Overview

Horos is the consumer-facing application layer in a three-part astrology stack:

```text
Horos
  │
  ▼
Supabase Edge Function
  │
  ▼
Jyothisyam / Astro API
  │
  ├── Skyfield + JPL DE440s calculations
  └── Varahamihira classical interpretation engine
```

The mobile app focuses on user experience, identity, profiles, entitlements, notifications, horoscope delivery, birth-chart access and Panchanga presentation while protected server-side services remain responsible for sensitive credentials and deterministic calculations.

## Product Capabilities

Current application and backend work includes:

- authentication and session refresh;
- user profile creation, retrieval, updating and deletion;
- daily horoscope access;
- premium weekly and monthly horoscope routes;
- premium birth-chart access;
- premium Panchanga access;
- subscription status and verification;
- RevenueCat-compatible entitlement handling;
- notification-device registration;
- protected Astro calculation requests;
- unique Horos request identifiers;
- durable downstream request metering;
- normalized Panchanga presentation.

## Architecture

```text
Expo Mobile App
      │
      ├── Expo Router
      ├── React Query
      ├── SecureStore / SQLite
      ├── Notifications
      └── RevenueCat client
      │
      ▼
Supabase Edge Function: horos-api
      │
      ├── Authentication
      ├── Profiles
      ├── Entitlements
      ├── Notifications
      └── Protected service adapter
      │
      ▼
Jyothisyam / Astro
      │
      ├── JPL DE440s astronomy
      ├── Vedic calculations
      ├── regression baselines
      └── durable usage metering
```

The active server entrypoint is:

```text
supabase/functions/horos-api/index.ts
```

The `worker/` workspace is retained as legacy Cloudflare Worker code and is still type-checked, but it is not the primary backend path for the current Horos architecture.

## Technology

| Area | Technology |
|---|---|
| Mobile | Expo 56 · React Native 0.85 |
| Language | TypeScript |
| Routing | Expo Router |
| Data fetching | TanStack React Query |
| Backend | Supabase Edge Functions |
| Secure storage | Expo SecureStore |
| Local storage | Expo SQLite |
| Notifications | Expo Notifications |
| Billing | RevenueCat / react-native-purchases |
| Icons / UI | Lucide React Native · React Native SVG |
| Animation | Reanimated · Worklets |
| Calculation service | Jyothisyam / Astro API |

## Security Boundary

Horos follows a strict client/server secret boundary.

The mobile application must never contain protected credentials such as:

- Astro service API keys;
- Supabase service-role or secret keys;
- RevenueCat server or webhook secrets;
- signing or service-account credentials.

The mobile app receives only public client configuration. Protected service calls are made from the server-side Horos adapter, while Astro owns its own durable metering credentials and calculation runtime.

Local `.env` files, signing material, service accounts and other production secrets are excluded from source control.

## Active API Routes

| Method | Route | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/profile/create` | Signed in |
| GET | `/profile/me` | Signed in |
| PUT | `/profile/update` | Signed in |
| DELETE | `/profile/me` | Signed in |
| GET | `/horoscope/daily` | Signed in |
| GET | `/horoscope/weekly` | Premium |
| GET | `/horoscope/monthly` | Premium |
| GET | `/birth-chart` | Premium |
| GET | `/panchang/today` | Premium |
| GET | `/subscription/status` | Signed in |
| POST | `/subscription/verify` | Signed in |
| POST | `/subscription/webhook` | RevenueCat authorization |
| POST | `/notifications/register` | Signed in |

## Calculation & Validation Boundary

Horos does not independently calculate planetary positions. It consumes the protected Jyothisyam / Astro service, which owns astronomical calculation contracts, JPL regression baselines and external-validation evidence.

Internal regression snapshots protect against unintended calculation drift but are not represented as independent external proof. External validation claims remain gated on reviewed evidence recorded in the Astro project.

This separation prevents the consumer application from overstating the certainty of its calculation layer.

## Repository Structure

```text
app/                                           Expo Router screens
components/                                    shared mobile UI
constants/                                     theme tokens
hooks/                                         React Query hooks
lib/                                           mobile API, storage and billing adapters
providers/                                     app/session/theme providers
supabase/functions/horos-api/                  active Supabase Edge Function
supabase/config.toml                           function configuration
worker/                                        legacy Cloudflare Worker workspace
scripts/                                       readiness and verification tooling
docs/                                          deployment and operator documentation
```

## Local Development

Requirements:

- Node.js `20.19.4`
- npm `10.8.2`

```bash
npm ci
cp .env.example .env
npx expo start
```

The repository pins its Node/npm toolchain to improve reproducibility.

## Quality Checks

```bash
npm run typecheck
npm run lint
```

The backend can additionally be checked and tested with Deno using the configuration committed under the Edge Function directory.

Repository verification scripts also cover reproducible tooling, production fail-closed behavior, private-beta configuration and hosted compatibility gates.

## Deployment Safety

Horos intentionally separates local/private-beta verification from hosted deployment.

The repository includes checks for:

- project binding;
- migration presence;
- Row Level Security and service-only controls;
- public-versus-protected route boundaries;
- production CORS and HTTPS expectations;
- mobile secret separation;
- production build safety flags;
- hosted compatibility and rollback readiness.

Hosted availability should only be claimed after the remote Edge Function, secrets, database state and protected Astro endpoint have passed end-to-end acceptance testing.

## Status

**Active development / hosted private-beta preparation.**

The protected local Horos-to-Astro path, entitlement contract, chart and Panchanga integration, local smoke testing and hosted-readiness audits are established. Remaining release work includes final hosted deployment verification, production OTP delivery, billing verification, remote end-to-end testing and private-beta store distribution.

## Responsible Use

Horos presents astrology for cultural, spiritual and reflective use. Astrology is not scientifically established as a reliable predictor of future events and should not replace professional medical, legal, mental-health, financial or other qualified advice.

---

<div align="center">

**Horos → protected application layer for the Jyothisyam calculation stack.**

A MiCirql product.

</div>
