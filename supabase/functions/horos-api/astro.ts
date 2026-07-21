import type { AstroPanchangaResponse, AstroPositionsResponse, ChartResult, ProfileInput } from "./types.ts";

const CALCULATION_PROFILE = "south_indian_drik_lahiri_jpl_de440s_v1";
const RASHI_NAMES = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"] as const;
const ELEMENTS = ["Fire", "Earth", "Air", "Water"] as const;

export class AstroProviderError extends Error {
  constructor(message: string, public status = 502, public providerStatus?: number) {
    super(message);
    this.name = "AstroProviderError";
  }
}

function providerUrl(): string {
  const value = Deno.env.get("ASTRO_API_URL")?.trim().replace(/\/$/, "");
  if (!value) throw new AstroProviderError("The JPL Astro calculation API is not configured.", 503);
  return value;
}

async function astroRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const key = Deno.env.get("ASTRO_API_KEY")?.trim();
  try {
    const response = await fetch(`${providerUrl()}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : `Astro API returned HTTP ${response.status}.`;
      throw new AstroProviderError(detail, 502, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof AstroProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AstroProviderError("The JPL Astro API timed out.", 504);
    }
    throw new AstroProviderError(error instanceof Error ? error.message : "The JPL Astro API is unavailable.");
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

export async function calculateChart(input: ProfileInput): Promise<ChartResult> {
  const positions = await astroRequest<AstroPositionsResponse>("/v1/positions", birthPayload(input));
  const moon = positions.planets.find((point) => point.body === "moon");
  if (!moon) throw new AstroProviderError("The JPL Astro API response did not include the Moon.");
  const planetaryPositions = Object.fromEntries(positions.planets.map((point) => [point.body, point.longitude]));
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
    },
    rawPositions: positions,
  };
}
