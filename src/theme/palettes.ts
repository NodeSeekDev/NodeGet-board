// shadcn-vue color palettes. Each entry overrides the top-level CSS
// variables defined in app.css. Values track shadcn-vue v3's registry.

export type ColorThemeName =
  | "zinc"
  | "rose"
  | "blue"
  | "orange"
  | "yellow"
  | "stone"
  | "red"
  | "green"
  | "violet"
  | "custom";

export const DEFAULT_CUSTOM_COLOR = "#3b82f6";

type Variant = Record<string, string>;

interface Palette {
  swatch: string;
  light: Variant;
  dark: Variant;
}

const make = (primary: string, foreground: string, ring: string): Variant => ({
  "--primary": primary,
  "--primary-foreground": foreground,
  "--ring": ring,
  "--sidebar-primary": primary,
  "--sidebar-primary-foreground": foreground,
  "--sidebar-ring": ring,
});

export const PALETTES: Record<Exclude<ColorThemeName, "custom">, Palette> = {
  zinc: {
    swatch: "oklch(0.21 0.006 285.885)",
    light: make(
      "oklch(0.21 0.006 285.885)",
      "oklch(0.985 0 0)",
      "oklch(0.705 0.015 286.067)",
    ),
    dark: make(
      "oklch(0.985 0 0)",
      "oklch(0.21 0.006 285.885)",
      "oklch(0.552 0.016 285.938)",
    ),
  },
  rose: {
    swatch: "oklch(0.645 0.246 16.439)",
    light: make(
      "oklch(0.645 0.246 16.439)",
      "oklch(0.969 0.015 12.422)",
      "oklch(0.645 0.246 16.439)",
    ),
    dark: make(
      "oklch(0.712 0.194 13.428)",
      "oklch(0.969 0.015 12.422)",
      "oklch(0.712 0.194 13.428)",
    ),
  },
  blue: {
    swatch: "oklch(0.546 0.245 262.881)",
    light: make(
      "oklch(0.546 0.245 262.881)",
      "oklch(0.97 0.014 254.604)",
      "oklch(0.546 0.245 262.881)",
    ),
    dark: make(
      "oklch(0.623 0.214 259.815)",
      "oklch(0.97 0.014 254.604)",
      "oklch(0.623 0.214 259.815)",
    ),
  },
  orange: {
    swatch: "oklch(0.705 0.213 47.604)",
    light: make(
      "oklch(0.705 0.213 47.604)",
      "oklch(0.98 0.016 73.684)",
      "oklch(0.705 0.213 47.604)",
    ),
    dark: make(
      "oklch(0.769 0.188 70.08)",
      "oklch(0.98 0.016 73.684)",
      "oklch(0.769 0.188 70.08)",
    ),
  },
  yellow: {
    swatch: "oklch(0.795 0.184 86.047)",
    light: make(
      "oklch(0.795 0.184 86.047)",
      "oklch(0.421 0.095 57.708)",
      "oklch(0.795 0.184 86.047)",
    ),
    dark: make(
      "oklch(0.852 0.199 91.936)",
      "oklch(0.421 0.095 57.708)",
      "oklch(0.852 0.199 91.936)",
    ),
  },
  stone: {
    swatch: "oklch(0.45 0.045 60)",
    light: make(
      "oklch(0.45 0.045 60)",
      "oklch(0.985 0.008 90)",
      "oklch(0.7 0.04 55)",
    ),
    dark: make(
      "oklch(0.82 0.06 75)",
      "oklch(0.28 0.035 55)",
      "oklch(0.66 0.045 65)",
    ),
  },
  red: {
    swatch: "oklch(0.637 0.237 25.331)",
    light: make(
      "oklch(0.637 0.237 25.331)",
      "oklch(0.971 0.013 17.38)",
      "oklch(0.637 0.237 25.331)",
    ),
    dark: make(
      "oklch(0.704 0.191 22.216)",
      "oklch(0.971 0.013 17.38)",
      "oklch(0.704 0.191 22.216)",
    ),
  },
  green: {
    swatch: "oklch(0.6 0.146 152.486)",
    light: make(
      "oklch(0.6 0.146 152.486)",
      "oklch(0.982 0.018 155.826)",
      "oklch(0.6 0.146 152.486)",
    ),
    dark: make(
      "oklch(0.696 0.17 162.48)",
      "oklch(0.982 0.018 155.826)",
      "oklch(0.696 0.17 162.48)",
    ),
  },
  violet: {
    swatch: "oklch(0.541 0.281 293.75)",
    light: make(
      "oklch(0.541 0.281 293.75)",
      "oklch(0.969 0.016 293.756)",
      "oklch(0.541 0.281 293.75)",
    ),
    dark: make(
      "oklch(0.606 0.25 292.717)",
      "oklch(0.969 0.016 293.756)",
      "oklch(0.606 0.25 292.717)",
    ),
  },
};

export const COLOR_THEME_KEYS: ColorThemeName[] = [
  ...(Object.keys(PALETTES) as Exclude<ColorThemeName, "custom">[]),
  "custom",
];

export const isColorThemeName = (v: unknown): v is ColorThemeName =>
  typeof v === "string" && (COLOR_THEME_KEYS as string[]).includes(v);

// Pick black or white foreground based on the perceived luminance of `color`.
const pickContrastForeground = (color: string): string => {
  const hex = color.replace(/^#/, "");
  if (hex.length !== 6 && hex.length !== 3) return "#ffffff";
  const norm =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(norm.slice(0, 2), 16);
  const g = parseInt(norm.slice(2, 4), 16);
  const b = parseInt(norm.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6 ? "#ffffff" : "#0a0a0a";
};

export const buildCustomPalette = (hex: string): Palette => {
  const fg = pickContrastForeground(hex);
  return {
    swatch: hex,
    light: make(hex, fg, hex),
    dark: make(hex, fg, hex),
  };
};
