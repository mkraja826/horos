# JPL Astro provider contract

Horos uses the separate `mkraja826/Astro` FastAPI service as its only production calculation provider.

## Provider identity

```text
engine: Jyothisyam API
astronomical provider: Skyfield + JPL DE440s
calculation profile: south_indian_drik_lahiri_jpl_de440s_v1
```

There is no Swiss Ephemeris fallback and no seeded calculation fallback in production.

## Configuration

The Supabase Edge Function reads:

```text
ASTRO_API_URL
ASTRO_API_KEY (optional)
```

Requests time out and return a provider-unavailable error rather than presenting estimated values as authoritative.

## Birth positions

```http
POST {ASTRO_API_URL}/v1/positions
```

Request:

```json
{
  "birth": {
    "local_datetime": "1998-10-26T10:28:00",
    "timezone": "Asia/Kolkata",
    "latitude": 16.575,
    "longitude": 79.312,
    "altitude_meters": 120
  },
  "calculation_profile": "south_indian_drik_lahiri_jpl_de440s_v1"
}
```

Horos derives the consumer summary as follows:

- Rāśi: Moon's sidereal sign
- Nakṣatra and Pada: Moon placement
- Lagna: sidereal Ascendant
- planetary positions: provider longitudes
- provenance: provider engine, ephemeris model, profile and ayanāṁśa

Interpretive strengths, challenges and personality claims are not inferred from these values until a separately validated interpretation layer is implemented.

## Panchanga

```http
POST {ASTRO_API_URL}/v1/panchanga
```

Request:

```json
{
  "location": {
    "local_date": "2026-07-21",
    "timezone": "Asia/Kolkata",
    "latitude": 16.575,
    "longitude": 79.312,
    "altitude_meters": 120
  },
  "calculation_profile": "south_indian_drik_lahiri_jpl_de440s_v1"
}
```

Horos displays only fields returned by the provider:

- Vara
- Tithi and Paksha
- Nakṣatra and Pada
- Yoga
- Karaṇa
- geometric solar-centre sunrise and sunset

Rahu Kāla, Yamagandam, Gulika Kāla, festival notes and auspicious periods are not fabricated when the provider does not calculate them.

## Required input quality

Birth chart calculation requires exact civil time, an IANA birth timezone and numeric coordinates. Place-name text alone is not sufficient. The API must reject missing coordinates or an unknown timezone.

## Validation

The Astro repository contains twelve digest-locked JPL regression baselines. These protect calculation stability but are not a substitute for two-source external Jyotiṣa software review.
