// Design tokens for PagneMarket - premium African fabric marketplace.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FAF8F3",
  onSurface: "#111111",
  surfaceSecondary: "#E8DCC8",
  onSurfaceSecondary: "#111111",
  surfaceTertiary: "#FFFFFF",
  onSurfaceTertiary: "#111111",
  surfaceInverse: "#111111",
  onSurfaceInverse: "#FAF8F3",
  muted: "#595550",

  // Brand
  brand: "#111111",
  onBrand: "#FAF8F3",
  brandPrimary: "#111111",
  onBrandPrimary: "#FAF8F3",
  brandSecondary: "#B85C38",
  onBrandSecondary: "#FAF8F3",
  brandTertiary: "#C8A96B",
  onBrandTertiary: "#111111",

  // Status
  success: "#173F35",
  onSuccess: "#FFFFFF",
  warning: "#C8A96B",
  onWarning: "#111111",
  error: "#B85C38",
  onError: "#FFFFFF",
  info: "#E8DCC8",
  onInfo: "#111111",

  // Lines
  border: "#E8DCC8",
  borderStrong: "#C8A96B",
  divider: "#E8DCC8",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export const colors = light;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
