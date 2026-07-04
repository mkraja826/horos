import * as SecureStore from "expo-secure-store";

const isWeb = process.env.EXPO_OS === "web";

export async function getSecureValue(key: string) {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setSecureValue(key: string, value: string) {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function deleteSecureValue(key: string) {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getSecureJson<T>(key: string): Promise<T | null> {
  const value = await getSecureValue(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    await deleteSecureValue(key);
    return null;
  }
}

export function setSecureJson<T>(key: string, value: T) {
  return setSecureValue(key, JSON.stringify(value));
}
