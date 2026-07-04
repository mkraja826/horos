export const lightColors = {
  background: "#FFF9EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F7EEDC",
  text: "#18213A",
  textMuted: "#686B75",
  primary: "#B85D2A",
  primaryPressed: "#94441E",
  primarySoft: "#F8E0C6",
  secondary: "#172A52",
  secondarySoft: "#E4E9F2",
  gold: "#C9973E",
  maroon: "#7A2F38",
  success: "#3E7657",
  warning: "#9A6426",
  border: "#E8DCC8",
  overlay: "rgba(23, 42, 82, 0.12)",
  white: "#FFFFFF"
} as const;

export const darkColors: ColorPalette = {
  background: "#0F172B",
  surface: "#18233B",
  surfaceMuted: "#222F49",
  text: "#FFF8E9",
  textMuted: "#B9B8B1",
  primary: "#E18A4D",
  primaryPressed: "#C66D35",
  primarySoft: "#3B2B27",
  secondary: "#D7E1FF",
  secondarySoft: "#273450",
  gold: "#E0B35A",
  maroon: "#D88993",
  success: "#77B58A",
  warning: "#E8B266",
  border: "#34435E",
  overlay: "rgba(0, 0, 0, 0.34)",
  white: "#FFFFFF"
};

export type ColorPalette = { [K in keyof typeof lightColors]: string };
export type ThemeMode = "system" | "light" | "dark";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999
} as const;
