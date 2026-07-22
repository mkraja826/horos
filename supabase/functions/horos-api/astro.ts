import type {
  AstroPanchangaResponse,
  AstroPositionsResponse,
  AstroPredictionResponse,
  BirthDetailsRow,
  ChartResult,
  HoroscopePrediction,
  Period,
  ProfileInput,
} from "./types.ts";

const CALCULATION_PROFILE = "south_indian_drik_lahiri_jpl_de440s_v1";
const RASHI_NAMES = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrishchika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
] as const;
const ELEMENTS = ["Fire", "Earth", "Air", "Water"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AstroProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public providerStatus?: number,
    public providerCode?: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "AstroProviderError";
  }
}

function providerUrl(): string {
  const value = Deno.env.get("ASTRO_API_URL")?.trim().replace(/\/$/, "");
  if (!value) throw new AstroProviderError("The JPL Astro calculation API is not configured.", 503);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AstroProviderError("The JPL Astro calculation API URL is invalid.", 503);
  }
  const environment = Deno.env.get("ENVIRONMENT") ?? "development";
  if (environment === "production" && parsed.protocol !== "https:") {
    throw new AstroProviderError("The JPL Astro calculation API must use HTTPS.", 503);
  }
  return value;
}

function providerKey(): string {
  const value = Deno.env.get("ASTRO_API_KEY")?.trim();
  if (!value) throw new AstroProviderError("The JPL Astro service credential is not configured.", 503);
  return value;
}

function consumerId(value: string): string {
  const normalized = value.trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new AstroProviderError("The Horos consumer identity is invalid.", 500);
  }
  return normalized;
}

export function buildAstroProviderHeaders(
  apiKey: string,
  astroConsumerId: string,
  requestId: string,
): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Astro-Consumer-ID": astroConsumerId,
    "X-Request-ID": requestId,
  };
}

function providerErrorDetails(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const object = payload as Record<string, unknown>;
  const code = typeof object.code === "string" ? object.code : undefined;
  const message = typeof object.message === "string"
    ? object.message
    : typeof object.detail === "string"
    ? object.detail
    : undefined;
  return { code, message };
}

async function astroRequest<T>(
  path: string,
  body: Record<string, unknown>,
  astroConsumerId: string,
): Promise<{ payload: T; requestId: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const requestId = `horos-${crypto.randomUUID()}`;
  try {
    const response = await fetch(`${providerUrl()}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: buildAstroProviderHeaders(providerKey(), consumerId(astroConsumerId), requestId),
      body: JSON.stringify(body),
    });
    const responseRequestId = response.headers.get("x-request-id")?.trim() || requestId;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const details = providerErrorDetails(payload);
      throw new AstroProviderError(
        details.message ?? `Astro API returned HTTP ${response.status}.`,
        502,
        response.status,
        details.code,
        responseRequestId,
      );
    }
    return { payload: payload as T, requestId: responseRequestId };
  } catch (error) {
    if (error instanceof AstroProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AstroProviderError("The JPL Astro API timed out.", 504, undefined, undefined, requestId);
    }
    throw new AstroProviderError(
      error instanceof Error ? error.message : "The JPL Astro API is unavailable.",
      502,
      undefined,
      undefined,
      requestId,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function birthPayload(input: ProfileInput) {
  return {
    birth: {
      local_datetime: `${input.dateOfBirth}T${input.timeOfBirth}:00`,
      timezone: input.timezone,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude_meters: input.altitudeMeters ?? 0,
    },
    calculation_profile: CALCULATION_PROFILE,
  };
}

function rashiName(signIndex: number): string {
  return RASHI_NAMES[signIndex - 1] ?? `Sign ${signIndex}`;
}

function elementName(signIndex: number): string {
  return ELEMENTS[(signIndex - 1) % ELEMENTS.length] ?? "Unknown";
}

export async function calculateChart(input: ProfileInput, astroConsumerId: string): Promise<ChartResult> {
  const result = await astroRequest<AstroPositionsResponse>(
    "/v1/positions",
    birthPayload(input),
    astroConsumerId,
  );
  const positions = result.payload;
  const moon = positions.planets.find((point) => point.body === "moon");
  if (!moon) {
    throw new AstroProviderError(
      "The JPL Astro API response did not include the Moon.",
      502,
      undefined,
      "MOON_MISSING",
      result.requestId,
    );
  }
  const planetaryPositions = Object.fromEntries(
    positions.planets.map((point) => [point.body, point.longitude]),
  );
  return {
    rashi: rashiName(moon.sign_index),
    nakshatra: moon.nakshatra,
    lagna: rashiName(positions.ascendant.sign_index),
    birthStar: `${moon.nakshatra} – Pada ${moon.pada}`,
    element: elementName(moon.sign_index),
    nature: "Calculated placements only; interpretation is not enabled.",
    strengths: [],
    challenges: [],
    lifestyleBalance: "This chart is a calculation reference, not a guaranteed prediction.",
    planetaryPositions,
    calculationMode: "provider",
    calculationProfile: positions.calculation_profile,
    ayanamshaDegrees: positions.ayanamsha_degrees,
    provider: {
      engine: positions.metadata.engine,
      astronomicalProvider: positions.metadata.astronomical_provider,
      ephemerisModel: positions.metadata.ephemeris_model,
      requestId: result.requestId,
    },
    rawPositions: positions,
  };
}

function formatClock(isoValue: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(isoValue));
}

export function formatTithiLabel(paksha: string, name: string): string {
  const normalizedPaksha = paksha.trim().replace(/\s+/g, " ");
  const normalizedName = name.trim().replace(/\s+/g, " ");

  if (!normalizedPaksha) return normalizedName;
  if (!normalizedName) return normalizedPaksha;

  const lowerPaksha = normalizedPaksha.toLowerCase();
  const lowerName = normalizedName.toLowerCase();
  if (lowerName === lowerPaksha || lowerName.startsWith(`${lowerPaksha} `)) {
    return normalizedName;
  }

  return `${normalizedPaksha} ${normalizedName}`;
}

export async function calculatePanchang(
  input: {
    localDate: string;
    timezone: string;
    latitude: number;
    longitude: number;
    altitudeMeters?: number;
    locationLabel: string;
  },
  astroConsumerId: string,
) {
  const response = await astroRequest<AstroPanchangaResponse>(
    "/v1/panchanga",
    {
      location: {
        local_date: input.localDate,
        timezone: input.timezone,
        latitude: input.latitude,
        longitude: input.longitude,
        altitude_meters: input.altitudeMeters ?? 0,
      },
      calculation_profile: CALCULATION_PROFILE,
    },
    astroConsumerId,
  );
  const result = response.payload;
  return {
    date: result.local_date,
    location: input.locationLabel,
    vara: result.vara.name,
    tithi: formatTithiLabel(result.tithi.paksha, result.tithi.name),
    nakshatra: `${result.nakshatra.name} – Pada ${result.nakshatra.pada}`,
    yoga: result.yoga.name,
    karana: result.karana.name,
    sunrise: formatClock(result.solar_times.sunrise_local, result.timezone),
    sunset: formatClock(result.solar_times.sunset_local, result.timezone),
    calculationMode: "provider" as const,
    calculationProfile: result.calculation_profile,
    ayanamshaDegrees: result.ayanamsha_degrees,
    solarMethod: result.solar_times.method,
    provider: {
      engine: result.metadata.engine,
      astronomicalProvider: result.metadata.astronomical_provider,
      ephemerisModel: result.metadata.ephemeris_model,
      requestId: response.requestId,
    },
  };
}

export function localDateTimeInTimezone(timezone: string, date = new Date()): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

export async function calculatePrediction(
  birth: BirthDetailsRow,
  period: Period,
  astroConsumerId: string,
  now = new Date(),
): Promise<HoroscopePrediction> {
  const response = await astroRequest<AstroPredictionResponse>(
    "/v1/classical/varahamihira_v1/prediction",
    {
      birth: {
        local_datetime: `${birth.date_of_birth}T${birth.time_of_birth}:00`,
        timezone: birth.timezone,
        latitude: birth.latitude,
        longitude: birth.longitude,
        altitude_meters: birth.altitude_meters ?? 0,
      },
      as_of: {
        local_datetime: localDateTimeInTimezone(birth.timezone, now),
        timezone: birth.timezone,
      },
      period,
      calculation_profile: CALCULATION_PROFILE,
    },
    astroConsumerId,
  );
  return {
    ...response.payload,
    generatedAt: now.toISOString(),
    calculationMode: "provider",
    provider: { requestId: response.requestId },
  };
}

export function isAstroProviderConfigured(): boolean {
  return Boolean(
    Deno.env.get("ASTRO_API_URL")?.trim() && Deno.env.get("ASTRO_API_KEY")?.trim(),
  );
}
