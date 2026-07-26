export type AppEnvironment = "development" | "preview" | "production";

export type PublicRuntimeEnvironment = {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_ALLOW_DEMO_DATA?: string;
};

export type RuntimeConfig = {
  appEnvironment: AppEnvironment;
  apiUrl: string | null;
  isProduction: boolean;
  demoDataEnabled: boolean;
  configurationError: string | null;
};

function parseEnvironment(value: string | undefined): {
  value: AppEnvironment;
  error: string | null;
} {
  const normalized = value?.trim().toLowerCase() || "development";
  if (
    normalized === "development" ||
    normalized === "preview" ||
    normalized === "production"
  ) {
    return { value: normalized, error: null };
  }
  return {
    value: "development",
    error:
      "EXPO_PUBLIC_APP_ENV must be development, preview, or production.",
  };
}

function parseApiUrl(
  value: string | undefined,
  isProduction: boolean,
): { value: string | null; error: string | null } {
  const normalized = value?.trim().replace(/\/$/, "") || "";
  if (!normalized) return { value: null, error: null };

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        value: null,
        error: "EXPO_PUBLIC_API_URL must use HTTP or HTTPS.",
      };
    }
    if (isProduction && parsed.protocol !== "https:") {
      return {
        value: null,
        error: "Production EXPO_PUBLIC_API_URL must use HTTPS.",
      };
    }
    return { value: normalized, error: null };
  } catch {
    return {
      value: null,
      error: "EXPO_PUBLIC_API_URL must be a valid absolute URL.",
    };
  }
}

export function evaluateRuntimeConfig(
  environment: PublicRuntimeEnvironment,
): RuntimeConfig {
  const errors: string[] = [];
  const appEnvironment = parseEnvironment(environment.EXPO_PUBLIC_APP_ENV);
  if (appEnvironment.error) errors.push(appEnvironment.error);

  const isProduction = appEnvironment.value === "production";
  const demoRequested =
    environment.EXPO_PUBLIC_ALLOW_DEMO_DATA?.trim().toLowerCase() === "true";
  const demoDataEnabled = !isProduction && demoRequested;
  if (isProduction && demoRequested) {
    errors.push("Production builds cannot enable demo astrology data.");
  }

  const apiUrl = parseApiUrl(environment.EXPO_PUBLIC_API_URL, isProduction);
  if (apiUrl.error) errors.push(apiUrl.error);
  if (!apiUrl.value && !demoDataEnabled) {
    errors.push(
      isProduction
        ? "This production build is missing its secure astrology service configuration."
        : "Configure EXPO_PUBLIC_API_URL or explicitly enable demo data for development or preview.",
    );
  }

  return {
    appEnvironment: appEnvironment.value,
    apiUrl: apiUrl.value,
    isProduction,
    demoDataEnabled,
    configurationError: errors.length > 0 ? errors.join(" ") : null,
  };
}

export const runtimeConfig = evaluateRuntimeConfig({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_ALLOW_DEMO_DATA: process.env.EXPO_PUBLIC_ALLOW_DEMO_DATA,
});

export function requirePreviewMode(): void {
  if (!runtimeConfig.demoDataEnabled) {
    throw new Error(
      runtimeConfig.configurationError ??
        "Preview data is disabled. Connect to the configured astrology service.",
    );
  }
}
