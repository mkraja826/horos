# Preview and fixture data boundary

Horos contains deterministic fixture data for local UI development. It is not
astrology output and must never be presented by a production or private-beta
build.

## Central policy

`lib/runtime-config.ts` is the only runtime authority for public environment
configuration:

- production requires an absolute HTTPS `EXPO_PUBLIC_API_URL`;
- production always disables demo data, even if a demo flag is supplied;
- development and preview require
  `EXPO_PUBLIC_ALLOW_DEMO_DATA=true` before local OTP, profiles, trials, chart
  fixtures, Panchanga fixtures, or horoscope fixtures may be used;
- a missing provider with demo data disabled produces a visible service
  configuration error.
- a local preview token cannot be restored by a production-like build; its
  preview-only profile and subscription cache are discarded during startup.

`scripts/verify-production-fail-closed.mjs` tests the environment matrix and
both production-like EAS profiles. CI runs it before installing or deploying
application code.

## Intentional development-only data

| Location | Purpose | Guard |
|---|---|---|
| `lib/fixtures.ts` | UI fixtures for readings, chart and Panchanga | `runtimeConfig.demoDataEnabled` |
| `providers/app-provider.tsx` | Local OTP `123456`, local profile and trial | `requirePreviewMode()` |
| `hooks/use-vedic-data.ts` | Fixture selection during explicit preview | `runtimeConfig.demoDataEnabled` |

Test fixtures under `supabase/functions/horos-api/*_test.ts` are contract-test
inputs and are never bundled as runtime responses.

## Operator checks

Production and private-beta profiles must set:

```text
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api
EXPO_PUBLIC_ALLOW_DEMO_DATA=false
```

The preview EAS profile deliberately opts into demo data. It is an internal UI
artifact and must not be distributed as a product build.
