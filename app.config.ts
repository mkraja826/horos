import type { ExpoConfig } from "expo/config";

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "Daily Vedic Astro",
  slug: "daily-vedic-astro",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "dailyvedicastro",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.dailyvedicastro.app",
    infoPlist: {
      NSUserNotificationsUsageDescription:
        "Daily Vedic Astro uses notifications for the guidance reminders you choose."
    }
  },
  android: {
    package: "com.dailyvedicastro.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#17254A"
    }
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "expo-router",
    "expo-notifications",
    [
      "expo-secure-store",
      {
        "configureAndroidBackup": true,
        "faceIDPermission": "Allow Daily Vedic Astro to protect your private birth details."
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: projectId ? { projectId } : undefined
  }
};

export default config;
