# Phase 0 deployment and security status

Verified on 27 July 2026 against Supabase project `hdaugtypjpniesdgyral`.
This is a read-only status record. Verification did not change database,
function, secret, authentication, EAS, or hosting state.

## Status vocabulary

| State | Meaning |
|---|---|
| Implemented | Present in repository code or configuration |
| Tested locally | Exercised by local automated checks |
| Deployed | Present in the named hosted environment |
| Enabled | Available to the intended user path |
| Validated | Passed the stated independent or end-to-end evidence gate |
| Production-ready | All required operational gates are complete |

## Deployment truth

| Component | Current state | Evidence and remaining gate |
|---|---|---|
| Astro API | Deployed; provider reachable through Horos; not independently validated | Live Horos health returned HTTP 200 with `astroProvider=skyfield_jpl_de440s` and `astroProviderConfigured=true`. Astro still has zero two-source-validated frozen cases. |
| Horos Edge Function | Deployed and enabled | Supabase reports active `horos-api` version 28. Public health passed. Gateway JWT verification is disabled by design; live unauthenticated probes of `/profile`, `/auth/refresh`, and `/subscription/webhook` each returned HTTP 401. |
| Supabase migrations | Deployed | All 18 repository migrations have corresponding live migration records. Live migration timestamps differ for several later migrations, but their ordered names and controls match. |
| Required Edge secrets | Partially verified | Health proves the Astro provider configuration is usable. Secret values were not read. RevenueCat credentials and OTP-provider configuration remain unverified. |
| EAS configuration | Implemented; production-safety fix pending merge | Production/private-beta fail-closed validation is implemented in draft PR #55. EAS project ID and RevenueCat public SDK keys remain operator-owned gates. No production build was created in this phase. |
| OTP | Implemented; not production-validated | Request, verification, refresh, and abuse-control contracts are tested locally. No live OTP was requested because that would contact a user and may incur provider cost. |
| RevenueCat | Implemented; not production-validated | Webhook ordering, replay safety, entitlement mapping, and expiration contracts are tested locally. Live product, purchase, restore, refund, and signed webhook flows remain unverified. |
| Compatibility | Deployed; disabled | Live health returned `phase4CompatibilityEnabled=false`. It remains outside the private-beta path. |
| Phase 4 analysis | Deployed; disabled | Live health returned `phase4AnalysisEnabled=false`. Its cache is service-only and empty. |
| Mobile-to-Horos-to-Astro | Components deployed; full flow not validated | Public Horos-to-Astro health passed. A disposable authenticated mobile flow covering OTP, profile, chart, Panchanga, refresh, entitlement, and deletion has not been completed. |
| Rollback | Implemented as a runbook; not rehearsed in production | Follow the rollback procedure below. Database migrations must not be reversed blindly. |

## Database and security audit

Read-only catalog queries and Supabase advisors produced these results:

- all 16 public tables have RLS enabled;
- `profiles`, `birth_details`, `notifications`, `horoscope_cache`, and
  `subscriptions` use owner-scoped policies;
- user-owned sensitive tables reference `auth.users(id)` with
  `ON DELETE CASCADE`;
- service-only caches, metering, rate-limit, maintenance, saved-partner, and
  analysis tables have no client grants or deny-all client policies;
- all 12 `SECURITY DEFINER` functions deny execution to `PUBLIC`, `anon`, and
  `authenticated`, and pin their search path;
- live protected-profile, invalid-refresh, and unsigned-webhook probes all
  failed closed with HTTP 401;
- RevenueCat events have a unique primary key and atomic ordering logic for
  idempotent processing;
- daily retention and hourly maintenance-watchdog cron jobs are active;
- no critical Supabase Security Advisor finding is open.

Advisor follow-up:

- five service-only tables are reported as “RLS enabled, no policy.” This is
  intentional because `anon` and `authenticated` have no table grants;
- leaked-password protection is disabled. Horos currently uses passwordless
  OTP, so this is not a private-beta blocker, but it must be enabled before any
  password sign-in method is offered;
- six indexes are currently reported unused. The database is very new and has
  little traffic, so removing them now would be premature.

Supabase is moving existing projects to explicit Data API grants on
30 October 2026. Future migrations must grant only the operations actually
required and must continue enabling RLS independently.

## Phase 0 exit gate

| Gate | Status |
|---|---|
| Production fake-data fallback impossible | Implemented and tested in draft PR #55; pending review/merge |
| Required production environment validated | Implemented and tested in draft PR #55; pending review/merge |
| Existing test suites pass | Passed locally and in CI for draft PRs #55 and #56 |
| Deployment state documented | Complete in this document |
| No critical RLS or secret issue remains | Read-only audit passed; live secret values were not inspected |
| Experimental compatibility and analysis disabled | Verified live |
| Private-beta path fails safely | Code and contract tests pass; physical production-build test remains |

Phase 0 is not yet production-ready. It requires review and merge of draft PRs
#55 and #56, a production-profile device build, and one redacted disposable-user
end-to-end run. OTP and RevenueCat production verification remain operator-owned
external gates.

## Rollback

1. Stop private-beta invitations and disable affected client distribution.
2. Restore the previous known-good `horos-api` function version.
3. Keep compatibility and Phase 4 analysis flags disabled.
4. Do not reverse database migrations until their data and dependency effects
   have been reviewed and a forward-safe migration is prepared.
5. Rotate any credential exposed through logs, screenshots, or build output.
6. Re-run health, authentication, profile, chart, Panchanga, entitlement,
   deletion, and production fail-closed gates before resuming.
