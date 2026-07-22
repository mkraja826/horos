# Horos Private-Beta Local Runbook

## Scope

This runbook verifies the protected local calculation path without deploying paid or hosted infrastructure:

```text
Horos adapter -> local protected Astro API -> durable Astro Supabase usage metering
```

It is intentionally limited to localhost. It does not deploy a Supabase Edge Function, create cloud resources, change billing, or touch any unrelated Supabase project.

## Proven by this gate

A passing run proves all of the following:

- the Horos Git working tree is clean;
- local environment and signing-style secret files are not tracked by Git;
- Docker is available;
- the existing `astro-staging-durable` container is running;
- Astro readiness reports the `supabase` usage backend;
- durable metering is configured, reachable, and bound to project `hdaugtypjpniesdgyral`;
- Horos gateway regression tests pass;
- the real Horos `astro.ts` adapter can request a chart and Panchang from Astro;
- chart and Panchang requests retain distinct `horos-...` request IDs;
- the Panchang Tithi label is normalized without duplicated Paksha text.

## Security boundary

Never place any of these values in Expo public variables, screenshots, chat, commits, or mobile source code:

- `ASTRO_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase secret keys
- RevenueCat server or webhook secrets

The mobile app may receive only public client configuration. Horos server code calls Astro with the protected Astro API key. Astro alone owns its Supabase usage credential.

The local preflight reads the Astro API key only from:

```text
%LOCALAPPDATA%\Astro\staging-secrets\api_key
```

The script does not print the key and removes the temporary process environment variables in a `finally` block.

## Prerequisites

- Windows PowerShell
- Git
- Node.js and npm
- Docker Desktop
- local Horos checkout
- the existing protected Astro container named `astro-staging-durable`
- the protected Astro API key file at the path above

## Run the complete gate

From the Horos repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-private-beta-local.ps1
```

This runs the regression suite and consumes two durable metered Astro requests: one chart request and one Panchang request.

To verify readiness and unit contracts without consuming the two metered requests:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-private-beta-local.ps1 -SkipMeteredSmoke
```

## Required success output

The complete run must end with output equivalent to:

```text
Horos local Astro adapter smoke passed.
Chart request ID: horos-...
Panchang request ID: horos-...
Chart summary: Tula / Swati / Meena
Panchang summary: Krishna Dwadashi / Jyeshtha – Pada 1
Horos private-beta local preflight passed.
```

The two request IDs must be different. `Krishna Krishna Dwadashi` must not appear.

## Failure handling

### Docker is unavailable

Open Docker Desktop, wait for the engine to become ready, then rerun the command.

### Astro container is missing

Do not recreate it with guessed environment variables. Restore it only from the protected Astro staging setup.

### Astro readiness fails

Confirm only these sanitized fields:

```text
ready: true
backend: supabase
durable: true
reachable: true
project_ref: hdaugtypjpniesdgyral
```

Do not print or inspect container environment variables.

### Git working tree is dirty

Commit or stash the changes, then rerun the preflight. A private-beta gate must be reproducible from a known commit.

## What remains unproven

A successful local preflight does not prove:

- a hosted HTTPS Astro endpoint;
- a deployed Horos Supabase Edge Function;
- hosted Edge Function secrets;
- a real mobile-device request through the hosted function;
- OTP delivery in production;
- RevenueCat purchase and webhook flows;
- store release readiness.

Those are separate gates and must not be claimed until independently verified.

## Stop local services

After testing:

```powershell
docker stop astro-staging-durable
```
