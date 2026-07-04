# Astrology provider contract

The Worker deliberately keeps ephemeris math behind a provider boundary. Production calls the configured provider with `zodiac: "sidereal"` and `ayanamsa: "lahiri"`; if no provider is configured, production returns a service error rather than presenting estimated values as authoritative.

## Birth chart

`POST {ASTROLOGY_PROVIDER_URL}/birth-chart`

Request:

```json
{
  "dateOfBirth": "1986-08-14",
  "timeOfBirth": "07:30",
  "birthPlace": "Hyderabad, Telangana, India",
  "timezone": "Asia/Kolkata",
  "latitude": 17.385,
  "longitude": 78.4867,
  "zodiac": "sidereal",
  "ayanamsa": "lahiri"
}
```

Response:

```json
{
  "rashi": "Vrishabha",
  "nakshatra": "Rohini",
  "lagna": "Simha",
  "birthStar": "Rohini – 2nd Pada",
  "element": "Earth",
  "nature": "Steady and nurturing",
  "strengths": ["Patient decision-making"],
  "challenges": ["Holding worries silently"],
  "lifestyleBalance": "Keep steady routines with room for rest.",
  "dasha": "Jupiter major period",
  "planetaryPositions": { "sun": 117.42, "moon": 46.18 },
  "transitScore": 0.62
}
```

## Panchang

`POST {ASTROLOGY_PROVIDER_URL}/panchang`

Request includes date, location/timezone, coordinates, `zodiac` and `ayanamsa`. Return:

```json
{
  "date": "2026-06-24",
  "location": "Hyderabad, India",
  "tithi": "Shukla Navami",
  "nakshatra": "Hasta",
  "yoga": "Siddha",
  "karana": "Balava",
  "sunrise": "5:44 AM",
  "sunset": "6:52 PM",
  "rahuKalam": "12:18 PM – 1:56 PM",
  "yamagandam": "7:22 AM – 9:01 AM",
  "gulikaKalam": "10:39 AM – 12:18 PM",
  "auspiciousPeriod": "9:18 AM – 10:28 AM",
  "importantDay": "Optional festival or observance note"
}
```

Use an Indian-calendar/ephemeris vendor whose license permits caching and consumer display. Validate its Lahiri interpretation and sunrise-based day boundaries with a qualified Vedic astrologer before release.
