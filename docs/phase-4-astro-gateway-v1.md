# Phase 4 — Horos Astro gateway v1

Horos calls the Jyothisyam Python API only through the `horos-api` Supabase Edge Function. The Expo app never receives the Python service key, a Supabase server secret, or a Supabase service-role credential.

## Request path

```text
Horos Expo app
  -> authenticated Supabase Edge Function `horos-api`
  -> authenticated Jyothisyam API
  -> Astro Supabase durable usage metering
```

## Edge Function secrets

Configure these only in the Astro Supabase Edge Function secret store:

- `ASTRO_API_URL`: exact HTTPS base URL of the hosted Jyothisyam staging service.
- `ASTRO_API_KEY`: opaque Jyothisyam service API key.

Do not use the Supabase `sb_secret_...` key as `ASTRO_API_KEY`. The Supabase server key belongs only to the Jyothisyam service's durable metering connection.

## Metering identity

Every Jyothisyam request includes:

- `Authorization: Bearer <ASTRO_API_KEY>`
- `X-Astro-Consumer-ID: <authenticated Supabase user UUID>`
- `X-Request-ID: horos-<new UUID>`

The authenticated Horos user UUID is the durable metering consumer. Every provider call receives a fresh request ID. The Python API may return the accepted request ID in `X-Request-ID`; Horos stores it in provider metadata for operational tracing.

## Supported provider calls

- `POST /v1/positions` during profile creation.
- `POST /v1/panchanga` for the premium daily Panchang.

## Error contract

Provider failures are returned to the mobile client as:

```json
{
  "code": "ASTROLOGY_PROVIDER_UNAVAILABLE",
  "message": "Safe provider error message",
  "providerCode": "OPTIONAL_STABLE_PROVIDER_CODE",
  "requestId": "horos-..."
}
```

No secret value, request body, or birth data may be logged or returned in provider errors.

## Verification

Run the pure header contract tests:

```powershell
deno test supabase/functions/horos-api/astro_test.ts
```

Before deploying the Edge Function, verify the hosted Jyothisyam service:

- uses HTTPS,
- reports durable Astro metering ready,
- accepts the dedicated `ASTRO_API_KEY`,
- rejects missing consumer IDs,
- returns HTTP 409 when a request ID is reused.

Full Edge Function-to-Python verification remains blocked until an HTTPS Jyothisyam staging endpoint is available. Google Cloud billing and Cloud Run remain intentionally paused.
