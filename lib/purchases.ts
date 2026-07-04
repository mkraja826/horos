import { api } from "@/lib/api-client";

const PRODUCT_ID = "daily_vedic_astro_monthly_10";
let configuredFor: string | null = null;

async function getPurchases(userId: string) {
  if (process.env.EXPO_OS === "web") throw new Error("Store subscriptions are available on Android and iOS.");
  const module = await import("react-native-purchases");
  const Purchases = module.default;
  const apiKey =
    process.env.EXPO_OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!apiKey) throw new Error("Store billing is not configured for this build.");
  if (configuredFor !== userId) {
    Purchases.configure({ apiKey, appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}

export async function purchaseMonthly(userId: string) {
  const Purchases = await getPurchases(userId);
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const selected =
    packages.find((item) => item.product.identifier === PRODUCT_ID) ?? offerings.current?.monthly ?? packages[0];
  if (!selected) throw new Error("The monthly plan is not available in the store yet.");

  await Purchases.purchasePackage(selected);
  return api.verifySubscription(process.env.EXPO_OS === "ios" ? "ios" : "android", PRODUCT_ID);
}

export async function restorePurchases(userId: string) {
  const Purchases = await getPurchases(userId);
  await Purchases.restorePurchases();
  return api.verifySubscription(process.env.EXPO_OS === "ios" ? "ios" : "android", PRODUCT_ID);
}
