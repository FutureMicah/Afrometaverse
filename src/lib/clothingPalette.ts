/**
 * Clothing + character colour palette (three.js / CSS colour strings).
 *
 * Catalogue item colours, garment thread/button colours, and default character
 * skin/eye/hair/nail colours. Kept in one place so characterStore.ts has no inline
 * hex literals, matching VILLAGE_PALETTE, SCENE_PALETTE, swatchPalette and decorPalette.
 */
export const CLOTHING_PALETTE = {
  amber400: "#fbbf24",
  amber700: "#b45309",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  blue900: "#1e3a8a",
  bronze: "#8d5524",
  espresso: "#2c1810",
  gray200: "#e5e7eb",
  gray500: "#6b7280",
  gray800: "#1f2937",
  gray900: "#111827",
  green300: "#86efac",
  green800: "#166534",
  ink: "#1a1a1a",
  lime400: "#a3e635",
  lime700: "#4d7c0f",
  lime800: "#3f6212",
  lime900: "#365314",
  orange300: "#fdba74",
  orange500: "#f97316",
  orange800: "#9a3412",
  pink400: "#f472b6",
  purple500: "#a855f7",
  red500: "#ef4444",
  rose400: "#fb7185",
  rose600: "#e11d48",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate50: "#f8fafc",
  slate900: "#0f172a",
  stone100: "#f5f5f4",
  stone400: "#a8a29e",
  stone50: "#fafaf9",
  white: "#ffffff",
  zinc600: "#52525b",
} as const;

export type ClothingColorKey = keyof typeof CLOTHING_PALETTE;
