export type FlatMapPalette = {
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipShadow: string;
  mapBorder: string;
  mapArea: string;
  mapAreaHover: string;
  lineEffect: string;
  lineColor: string;
  lineShadow: string;
  userPoint: string;
  userPointBorder: string;
  userShadow: string;
  userLabelText: string;
  userLabelBackground: string;
  userLabelBorder: string;
  nodePoint: string;
  nodePointBorder: string;
  nodeShadow: string;
  nodeLabelText: string;
  emphasisLabelText: string;
  emphasisLabelBackground: string;
  emphasisLabelBorder: string;
};

export type GlobeMapPalette = {
  oceanTop: string;
  oceanMidTop: string;
  oceanMidBottom: string;
  oceanBottom: string;
  bloom: string;
  bloomFade: string;
  gridLine: string;
  landFill: string;
  landStroke: string;
  speckles: string;
  markerGlow: number;
  markerGlowHover: number;
  markerCore: number;
  markerCoreHover: number;
  userGlow: number;
  userCore: number;
  routeColor: number;
  fogColor: number;
  fogDensity: number;
  ambientIntensity: number;
  hemisphereSky: number;
  hemisphereGround: number;
  atmosphereColor: number;
  atmosphereOpacity: number;
  starColor: number;
  starOpacity: number;
  glowTextureRgb: string;
};

export type MapThemeMode = {
  shellBorderClass: string;
  frameClass: string;
  overlayClass: string;
  overlayLoadingTextClass: string;
  overlayErrorTextClass: string;
  tooltipPanelClass: string;
  tooltipMetaClass: string;
  tooltipListClass: string;
  flat: FlatMapPalette;
  globe: GlobeMapPalette;
};

export const MAP_THEME: Record<"dark" | "light", MapThemeMode> = {
  dark: {
    shellBorderClass: "theme-dark border-[rgba(103,232,249,0.14)]",
    frameClass: "border-[rgba(103,232,249,0.34)] opacity-100",
    overlayClass:
      "bg-[linear-gradient(180deg,rgba(3,10,20,0.82),rgba(5,15,28,0.9))]",
    overlayLoadingTextClass: "text-slate-300",
    overlayErrorTextClass: "text-red-300",
    tooltipPanelClass:
      "border-[rgba(56,189,248,0.28)] bg-[rgba(5,15,28,0.84)] text-sky-50 shadow-[0_18px_50px_rgba(2,8,23,0.42)]",
    tooltipMetaClass: "text-slate-300/90",
    tooltipListClass: "text-slate-200/90",
    flat: {
      tooltipBackground: "rgba(5, 15, 28, 0.94)",
      tooltipBorder: "rgba(56, 189, 248, 0.4)",
      tooltipText: "#dbeafe",
      tooltipShadow: "rgba(2, 12, 27, 0.42)",
      mapBorder: "rgba(103, 232, 249, 0.3)",
      mapArea: "#11324a",
      mapAreaHover: "#1e4f6d",
      lineEffect: "#67e8f9",
      lineColor: "rgba(34, 211, 238, 0.45)",
      lineShadow: "rgba(34, 211, 238, 0.25)",
      userPoint: "#ecfeff",
      userPointBorder: "#22d3ee",
      userShadow: "rgba(34, 211, 238, 0.42)",
      userLabelText: "#f8fafc",
      userLabelBackground: "rgba(6, 18, 34, 0.84)",
      userLabelBorder: "rgba(34, 211, 238, 0.26)",
      nodePoint: "#fde68a",
      nodePointBorder: "#fef3c7",
      nodeShadow: "rgba(251, 191, 36, 0.36)",
      nodeLabelText: "#f8fafc",
      emphasisLabelText: "#fefce8",
      emphasisLabelBackground: "rgba(31, 41, 55, 0.86)",
      emphasisLabelBorder: "rgba(250, 204, 21, 0.28)",
    },
    globe: {
      oceanTop: "#071a2c",
      oceanMidTop: "#0d2d45",
      oceanMidBottom: "#0a2236",
      oceanBottom: "#081421",
      bloom: "rgba(34, 211, 238, 0.08)",
      bloomFade: "rgba(34, 211, 238, 0)",
      gridLine: "rgba(186, 230, 253, 0.12)",
      landFill: "#4f6f86",
      landStroke: "rgba(103, 232, 249, 0.3)",
      speckles: "rgba(34, 211, 238, 0.025)",
      markerGlow: 0x22d3ee,
      markerGlowHover: 0x67e8f9,
      markerCore: 0xfbbf24,
      markerCoreHover: 0xfef3c7,
      userGlow: 0x67e8f9,
      userCore: 0xecfeff,
      routeColor: 0x22d3ee,
      fogColor: 0x020817,
      fogDensity: 0.03,
      ambientIntensity: 0.96,
      hemisphereSky: 0xbfefff,
      hemisphereGround: 0x07111d,
      atmosphereColor: 0x67e8f9,
      atmosphereOpacity: 0,
      starColor: 0xbfefff,
      starOpacity: 0.75,
      glowTextureRgb: "34, 211, 238",
    },
  },
  light: {
    shellBorderClass: "border-[rgba(186,230,253,0.88)]",
    frameClass: "border-[rgba(14,165,233,0.18)] opacity-90",
    overlayClass:
      "bg-[linear-gradient(180deg,rgba(250,253,255,0.82),rgba(235,245,255,0.9))]",
    overlayLoadingTextClass: "text-slate-500",
    overlayErrorTextClass: "text-red-500",
    tooltipPanelClass:
      "border-[rgba(14,165,233,0.14)] bg-[rgba(255,255,255,0.9)] text-slate-900 shadow-[0_16px_36px_rgba(14,165,233,0.12)]",
    tooltipMetaClass: "text-slate-700/82",
    tooltipListClass: "text-slate-900/88",
    flat: {
      tooltipBackground: "rgba(255, 255, 255, 0.94)",
      tooltipBorder: "rgba(14, 165, 233, 0.16)",
      tooltipText: "#0f172a",
      tooltipShadow: "rgba(14, 165, 233, 0.14)",
      mapBorder: "rgba(125, 211, 252, 0.78)",
      mapArea: "#6d879e",
      mapAreaHover: "#4f7392",
      lineEffect: "#0ea5e9",
      lineColor: "rgba(14, 165, 233, 0.36)",
      lineShadow: "rgba(56, 189, 248, 0.18)",
      userPoint: "#f8fdff",
      userPointBorder: "#0ea5e9",
      userShadow: "rgba(14, 165, 233, 0.28)",
      userLabelText: "#0f172a",
      userLabelBackground: "rgba(248, 252, 255, 0.94)",
      userLabelBorder: "rgba(14, 165, 233, 0.16)",
      nodePoint: "#f59e0b",
      nodePointBorder: "#fff7d6",
      nodeShadow: "rgba(245, 158, 11, 0.24)",
      nodeLabelText: "#0f172a",
      emphasisLabelText: "#0f172a",
      emphasisLabelBackground: "rgba(255, 255, 255, 0.96)",
      emphasisLabelBorder: "rgba(14, 165, 233, 0.14)",
    },
    globe: {
      oceanTop: "#f6fbff",
      oceanMidTop: "#e9f5fe",
      oceanMidBottom: "#d9ebfa",
      oceanBottom: "#c8def1",
      bloom: "rgba(56, 189, 248, 0.1)",
      bloomFade: "rgba(56, 189, 248, 0)",
      gridLine: "rgba(14, 165, 233, 0.08)",
      landFill: "#88a0b3",
      landStroke: "rgba(125, 211, 252, 0.78)",
      speckles: "rgba(14, 165, 233, 0.03)",
      markerGlow: 0x0ea5e9,
      markerGlowHover: 0x67e8f9,
      markerCore: 0xfbbf24,
      markerCoreHover: 0xfef3c7,
      userGlow: 0x38bdf8,
      userCore: 0xf8fdff,
      routeColor: 0x0ea5e9,
      fogColor: 0xeaf6ff,
      fogDensity: 0.016,
      ambientIntensity: 1.08,
      hemisphereSky: 0xf8fdff,
      hemisphereGround: 0xd7e9f8,
      atmosphereColor: 0x38bdf8,
      atmosphereOpacity: 0,
      starColor: 0x7dd3fc,
      starOpacity: 0.12,
      glowTextureRgb: "2, 132, 199",
    },
  },
};
