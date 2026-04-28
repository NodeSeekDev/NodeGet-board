import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { applyTheme, initTheme } from "@/theme/dom";
import {
  PALETTES,
  buildCustomPalette,
  isColorThemeName,
  DEFAULT_CUSTOM_COLOR,
  type ColorThemeName,
} from "@/theme/palettes";

const COLOR_THEME_STORAGE_KEY = "color-theme";
const COLOR_THEME_CUSTOM_KEY = "color-theme-custom";

const readColorTheme = (): ColorThemeName => {
  try {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (isColorThemeName(stored)) return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  return "zinc";
};

const readCustomColor = (): string => {
  try {
    const stored = localStorage.getItem(COLOR_THEME_CUSTOM_KEY);
    if (typeof stored === "string" && /^#([0-9a-fA-F]{3,8})$/.test(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CUSTOM_COLOR;
};

const resolvePalette = (name: ColorThemeName, customColor: string) => {
  if (name === "custom") return buildCustomPalette(customColor);
  return PALETTES[name] ?? PALETTES.zinc;
};

const applyPalette = (
  name: ColorThemeName,
  dark: boolean,
  customColor: string,
) => {
  const palette = resolvePalette(name, customColor);
  if (!palette) return;
  const variant = (dark ? palette.dark : palette.light) ?? {};
  const root = document.documentElement.style;
  // Clear every key any palette could set so themes switch cleanly.
  for (const theme of Object.values(PALETTES)) {
    if (!theme) continue;
    for (const key of Object.keys(theme.light ?? {})) root.removeProperty(key);
    for (const key of Object.keys(theme.dark ?? {})) root.removeProperty(key);
  }
  for (const [key, value] of Object.entries(variant)) {
    root.setProperty(key, value);
  }
};

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(!!initTheme());
  const colorTheme = ref<ColorThemeName>(readColorTheme());
  const customColor = ref<string>(readCustomColor());

  applyPalette(colorTheme.value, isDark.value, customColor.value);

  const setTheme = (dark: boolean) => {
    isDark.value = dark;
    applyTheme(dark);
    applyPalette(colorTheme.value, dark, customColor.value);
  };

  const toggle = () => {
    setTheme(!isDark.value);
  };

  const setColorTheme = (name: ColorThemeName) => {
    colorTheme.value = name;
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
    applyPalette(name, isDark.value, customColor.value);
  };

  const setCustomColor = (hex: string) => {
    customColor.value = hex;
    try {
      localStorage.setItem(COLOR_THEME_CUSTOM_KEY, hex);
    } catch {
      /* ignore */
    }
    if (colorTheme.value === "custom") {
      applyPalette("custom", isDark.value, hex);
    }
  };

  watch(isDark, (dark) =>
    applyPalette(colorTheme.value, dark, customColor.value),
  );

  return {
    isDark,
    colorTheme,
    customColor,
    setTheme,
    toggle,
    setColorTheme,
    setCustomColor,
  };
});
