import "expo-sqlite/localStorage/install";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ColorPalette, type ThemeMode } from "@/constants/theme";

type ThemeContextValue = {
  colors: ColorPalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = "daily-vedic-theme";

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (saved === "system" || saved === "light" || saved === "dark") {
      setModeState(saved);
    }
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    localStorage.setItem(THEME_KEY, nextMode);
    setModeState(nextMode);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, mode, setMode }),
    [isDark, mode, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = React.use(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside ThemeProvider");
  return value;
}
