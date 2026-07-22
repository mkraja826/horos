# Horos

Horos is an Expo mobile application for Vedic astrology with a Supabase Edge Function backend and a protected Astro calculation service.

## Current architecture

```text
Expo mobile app
    -> Supabase Edge Function: horos-api
        -> protected Astro API
            -> Skyfield + JPL DE440s calculations
            -> durable Astro Supabase usage metering
```

The active server entrypoint is:

```text
supabase/functions/horos-api/index.ts
```

The `worker/` directory is retained as legacy Cloudflare Worker code and is still type-checked, but it is not the primary backend path for the current Horos integration.

## Calculation status

The current protected local path supports:

- birth-chart positions through the Astro `/v1/positions` endpoint;
- Panchang through the Astro `/v1/panchanga` endpoint;
- Lahiri sidereal calculations using the approved Astro calculation profile;
- distinct `horos-...` request IDs;
- durable metered requests;
- normalized Panchang Tithi labels.

The approved wording for external material is:

> Validated against JPL internal baselines and independently verified against Jagannatha Hora 8.0.

Do not claim hosted availability until the hosted HTTPS Astro endpoint and deployed Horos Edge Function have passed their own end-to-end gate.

## Security boundary

The mobile app must never contain:

- `ASTRO_API_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- Supabase secret keys;
- RevenueCat server or webhook secrets.

The mobile app receives only public client configuration. The Horos server adapter calls Astro with the protected Astro API key. Astro owns its own durable usage credential.

Never commit `.env`, `.env.local`, signing files, service-account files, or local secret files. The repository `.gitignore` protects these paths.

## Repository structure

```text
app/                                           Expo Router screens
components/                                    shared mobile UI
constants/                                     theme tokens
hooks/                                         React Query hooks
lib/                                           mobile API, storage and billing adapters
providers/                                     app/session/theme providers
supabase/functions/horos-api/                  active Supabase Edge Function
supabase/config.toml                           per-function Supabase gateway configuration
worker/                                        legacy Cloudflare Worker backend
scripts/verify-private-beta-local.ps1          local protected preflight
scripts/audit-hosted-deployment-readiness.ps1  zero-cloud-write hosted readiness audit
docs/PRIVATE_BETA_LOCAL_RUNBOOK.md             local operator runbook
docs/HOSTED_DEPLOYMENT_READINESS.md            hosted deployment checklist and rollback plan
```

## Mobile development

Requirements: Node.js 20+ and a recent npm.

```powershell
npm ci
Copy-Item .env.example .env
npx expo start
```

The example API URL points to the intended Horos Edge Function location. Hosted deployment and hosted secrets remain separate operator gates.

## Local protected private-beta preflight

Requirements:

- Docker Desktop;
- the existing `astro-staging-durable` container;
- the protected Astro API key at `%LOCALAPPDATA%\Astro\staging-secrets\api_key`.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-private-beta-local.ps1
```

This verifies Git cleanliness, secret-file exclusion, the Horos user-flow contract, durable Astro readiness, Horos gateway tests, and the real Horos-to-Astro chart and Panchang adapter smoke. The full run consumes two durable metered requests.

To skip the two metered requests:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-private-beta-local.ps1 -SkipMeteredSmoke
```

See [the private-beta local runbook](docs/PRIVATE_BETA_LOCAL_RUNBOOK.md) for expected output and failure handling.

## Hosted deployment static audit

Run before any hosted deployment work:

```powershell
powershell -ExecutionPolicy Bypass `
  -File .\scripts\audit-hosted-deployment-readiness.ps1
```

This static gate verifies project binding, migration presence, RLS and service-only controls, the public-versus-protected route boundary, production CORS and HTTPS enforcement, mobile secret separation, EAS production safety flags, and the committed Supabase function configuration. It reads and changes no cloud state.

See [the hosted deployment readiness guide](docs/HOSTED_DEPLOYMENT_READINESS.md) for required variable names, the paused deployment order, hosted acceptance criteria, and rollback steps.

## Quality checks

```powershell
npm run typecheck
npm run lint
npx --yes deno check --config=./supabase/functions/horos-api/deno.json ./supabase/functions/horos-api/index.ts
npx --yes deno test --config=./supabase/functions/horos-api/deno.json ./supabase/functions/horos-api/astro_test.ts
npx --yes deno test --config=./supabase/functions/horos-api/deno.json ./supabase/functions/horos-api/user_flow_test.ts
```

GitHub CI also runs the static hosted readiness audit and type-checks the local Astro adapter smoke.

## Active API routes

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

## Roadmap gate

Completed locally:

- protected Astro service;
- durable Supabase metering;
- Horos adapter contract;
- onboarding and entitlement user-flow contract;
- chart and Panchang local integration;
- repeatable local smoke;
- Panchang Tithi normalization;
- static hosted deployment repository audit.

Still pending:

- hosted HTTPS Astro endpoint;
- remote Horos migration verification;
- hosted Horos Edge Function secrets and deployment;
- hosted mobile-to-Horos-to-Astro end-to-end test;
- OTP production delivery;
- RevenueCat production verification;
- EAS production public variables and private-beta store distribution.
