export type FlatMapPalette = {
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipShadow: string;
  mapBorder: string;
  mapArea: string;
  mapAreaHover: string;
  unlockedMapArea: string;
  unlockedMapAreaHover: string;
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
  nodeSelectedPoint: string;
  nodeSelectedPointBorder: string;
  nodeSelectedShadow: string;
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
  unlockedLandFill: string;
  unlockedLandStroke: string;
  speckles: string;
  markerGlow: number;
  markerGlowHover: number;
  markerCore: number;
  markerCoreHover: number;
  markerGlowSelected: number;
  markerCoreSelected: number;
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
      unlockedMapArea: "#1f5b3f",
      unlockedMapAreaHover: "#2b7a53",
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
      nodeSelectedPoint: "#4ade80",
      nodeSelectedPointBorder: "#dcfce7",
      nodeSelectedShadow: "rgba(74, 222, 128, 0.42)",
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
      unlockedLandFill: "#3e6f55",
      unlockedLandStroke: "rgba(134, 239, 172, 0.42)",
      speckles: "rgba(34, 211, 238, 0.025)",
      markerGlow: 0x22d3ee,
      markerGlowHover: 0x67e8f9,
      markerCore: 0xfbbf24,
      markerCoreHover: 0xfef3c7,
      markerGlowSelected: 0x4ade80,
      markerCoreSelected: 0xdcfce7,
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
    shellBorderClass: "border-[rgba(191,219,254,0.72)]",
    frameClass: "border-[rgba(59,130,246,0.16)] opacity-90",
    overlayClass:
      "bg-[linear-gradient(180deg,rgba(246,249,252,0.82),rgba(233,240,247,0.9))]",
    overlayLoadingTextClass: "text-slate-600",
    overlayErrorTextClass: "text-red-500",
    tooltipPanelClass:
      "border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.94)] text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
    tooltipMetaClass: "text-slate-600/90",
    tooltipListClass: "text-slate-900/88",
    flat: {
      tooltipBackground: "rgba(255, 255, 255, 0.96)",
      tooltipBorder: "rgba(148, 163, 184, 0.2)",
      tooltipText: "#0f172a",
      tooltipShadow: "rgba(15, 23, 42, 0.1)",
      mapBorder: "rgba(148, 163, 184, 0.52)",
      mapArea: "#8a9cae",
      mapAreaHover: "#71879d",
      unlockedMapArea: "#9fc8ae",
      unlockedMapAreaHover: "#83b796",
      lineEffect: "#0284c7",
      lineColor: "rgba(3, 105, 161, 0.34)",
      lineShadow: "rgba(14, 116, 144, 0.12)",
      userPoint: "#f8fafc",
      userPointBorder: "#0284c7",
      userShadow: "rgba(2, 132, 199, 0.2)",
      userLabelText: "#0f172a",
      userLabelBackground: "rgba(255, 255, 255, 0.96)",
      userLabelBorder: "rgba(148, 163, 184, 0.2)",
      nodePoint: "#d97706",
      nodePointBorder: "#fffbeb",
      nodeShadow: "rgba(217, 119, 6, 0.18)",
      nodeSelectedPoint: "#15803d",
      nodeSelectedPointBorder: "#dcfce7",
      nodeSelectedShadow: "rgba(21, 128, 61, 0.18)",
      nodeLabelText: "#0f172a",
      emphasisLabelText: "#0f172a",
      emphasisLabelBackground: "rgba(255, 255, 255, 0.98)",
      emphasisLabelBorder: "rgba(148, 163, 184, 0.18)",
    },
    globe: {
      oceanTop: "#f3f7fb",
      oceanMidTop: "#e7eef6",
      oceanMidBottom: "#d7e2ed",
      oceanBottom: "#c7d5e3",
      bloom: "rgba(59, 130, 246, 0.06)",
      bloomFade: "rgba(59, 130, 246, 0)",
      gridLine: "rgba(100, 116, 139, 0.08)",
      landFill: "#90a4b6",
      landStroke: "rgba(148, 163, 184, 0.5)",
      unlockedLandFill: "#a7c8b1",
      unlockedLandStroke: "rgba(22, 101, 52, 0.22)",
      speckles: "rgba(51, 65, 85, 0.018)",
      markerGlow: 0x0284c7,
      markerGlowHover: 0x38bdf8,
      markerCore: 0xfbbf24,
      markerCoreHover: 0xfef3c7,
      markerGlowSelected: 0x16a34a,
      markerCoreSelected: 0xdcfce7,
      userGlow: 0x38bdf8,
      userCore: 0xffffff,
      routeColor: 0x0284c7,
      fogColor: 0xe6edf5,
      fogDensity: 0.018,
      ambientIntensity: 1.02,
      hemisphereSky: 0xf8fafc,
      hemisphereGround: 0xd9e2ec,
      atmosphereColor: 0x93c5fd,
      atmosphereOpacity: 0,
      starColor: 0x94a3b8,
      starOpacity: 0.08,
      glowTextureRgb: "14, 116, 144",
    },
  },
};
