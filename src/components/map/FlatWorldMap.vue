<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { ChevronRight, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "@/stores/theme";
import { MAP_THEME } from "@/components/map/theme";
import { getDisplayCountryName } from "@/components/map/countryName";

type MapPoint = {
  id: string;
  name: string;
  region: string;
  isoCode?: string;
  nodeIds?: string[];
  count: number;
  nodes: string[];
  value: [number, number, number];
};

type UserLocation = {
  name: string;
  value: [number, number, number];
};

const props = defineProps<{
  points: MapPoint[];
  userLocation?: UserLocation | null;
  selectedNodeId?: string | null;
  unlockedCountries?: string[];
}>();
const emit = defineEmits<{
  (e: "select-node", nodeId: string): void;
}>();
const { t, locale } = useI18n();
const themeStore = useThemeStore();

const chartEl = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const loadError = ref("");
const pickedPoint = ref<MapPoint | null>(null);
const popoverPos = ref({ x: 0, y: 0 });
let chart: echarts.ECharts | null = null;
let lastPointsSignature = "";
let resizeObserver: ResizeObserver | null = null;
let cnameMap = new Map<string, string>();

const WORLD_MAP_URL = `${import.meta.env.BASE_URL}geo/world.json`;

const themeMode = computed(() =>
  themeStore.isDark ? MAP_THEME.dark : MAP_THEME.light,
);
const palette = computed(() => themeMode.value.flat);

const shellClass = computed(() => themeMode.value.shellBorderClass);

const frameClass = computed(() => themeMode.value.frameClass);

const overlayClass = computed(() => themeMode.value.overlayClass);

const HEAT: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [167, 243, 208],
  [52, 211, 153],
  [6, 95, 70],
];

function heatColor(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const seg = x >= 0.5 ? 1 : 0;
  const f = (x - seg * 0.5) * 2;
  const a = HEAT[seg];
  const b = HEAT[seg + 1]!;
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

function buildGeoRegions(
  unlockedCountries: string[],
): echarts.GeoComponentOption["regions"] {
  if (!unlockedCountries.length) return [];
  const nodeCountByIso = new Map<string, number>();
  for (const point of props.points) {
    if (point.isoCode) nodeCountByIso.set(point.isoCode, point.count);
  }
  const maxCount = Math.max(...nodeCountByIso.values(), 1);
  return unlockedCountries.map((iso) => {
    const count = nodeCountByIso.get(iso) ?? 0;
    const t = count / maxCount;
    const color = heatColor(0.2 + 0.8 * t);
    return {
      name: iso,
      itemStyle: { areaColor: color },
      emphasis: { itemStyle: { areaColor: heatColor(0.4 + 0.6 * t) } },
    };
  });
}

function getPointsSignature(points: MapPoint[]) {
  return JSON.stringify(
    points.map((point) => ({
      region: point.region,
      count: point.count,
      value: point.value,
      nodes: [...point.nodes].sort(),
    })),
  );
}

function getLineData(points: MapPoint[], userLocation?: UserLocation | null) {
  if (!userLocation) return [];
  return points.map((point) => ({
    coords: [
      [userLocation.value[0], userLocation.value[1]],
      [point.value[0], point.value[1]],
    ],
    fromName: userLocation.name,
    toName: point.region || point.name,
  }));
}

function getUserLabelPlacement(userLocation?: UserLocation | null) {
  const longitude = userLocation?.value?.[0] ?? 0;
  return longitude > 72
    ? { position: "left" as const, offset: [-10, 0] as [number, number] }
    : { position: "right" as const, offset: [10, 0] as [number, number] };
}

function getScatterData(points: MapPoint[]) {
  const colors = palette.value;
  return points.map((point) => {
    const isSelected =
      point.nodeIds?.includes(props.selectedNodeId ?? "") ??
      point.id === props.selectedNodeId;
    return {
      ...point,
      itemStyle: {
        color: isSelected ? colors.nodeSelectedPoint : colors.nodePoint,
        borderColor: isSelected
          ? colors.nodeSelectedPointBorder
          : colors.nodePointBorder,
        borderWidth: isSelected ? 3 : 2,
        shadowBlur: isSelected ? 22 : 18,
        shadowColor: isSelected ? colors.nodeSelectedShadow : colors.nodeShadow,
      },
    };
  });
}

function buildOption(): echarts.EChartsOption {
  const lineData = getLineData(props.points, props.userLocation);
  const colors = palette.value;
  const userLabelPlacement = getUserLabelPlacement(props.userLocation);
  const unlockedCountries = props.unlockedCountries ?? [];
  return {
    backgroundColor: "transparent",
    animationDuration: 650,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "item",
      enterable: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      padding: 12,
      textStyle: {
        color: colors.tooltipText,
        fontSize: 12,
        lineHeight: 18,
      },
      extraCssText: `box-shadow: 0 18px 50px ${colors.tooltipShadow}; border-radius: 14px; backdrop-filter: blur(14px);`,
      formatter: (params: any) => {
        if (params.componentType === "geo") {
          const iso = params.name as string;
          const countryDisplay = getDisplayCountryName(
            cnameMap.get(iso) ?? iso,
            locale.value,
          );
          const countryNodes = props.points.filter((p) => p.isoCode === iso);
          if (!countryNodes.length) return `<b>${countryDisplay}</b>`;
          const allNodeNames = countryNodes.flatMap((p) => p.nodes);
          return [
            `<b>${countryDisplay}</b>`,
            t("dashboard.map.tooltip.nodeCount", {
              count: allNodeNames.length,
            }),
            allNodeNames.join("<br/>"),
          ].join("<br/>");
        }
        if (params.seriesType === "lines") {
          return t("dashboard.map.lineTooltip", {
            from: params.data.fromName,
            to: params.data.toName,
          });
        }
        if (params.seriesType === "scatter") {
          return `<b>${params.name}</b>`;
        }
        if (params.seriesType === "effectScatter") {
          // 点击后显示持久 popover，hover tooltip 仅显示简要提示
          const data = params.data as MapPoint | undefined;
          if (!data) return "";
          return `<b>${data.region || data.name}</b>`;
        }
        return "";
      },
    },
    geo: {
      map: "world",
      roam: false,
      silent: false,
      zoom: 1.16,
      top: "10%",
      bottom: "8%",
      regions: buildGeoRegions(unlockedCountries),
      itemStyle: {
        borderColor: colors.mapBorder,
        borderWidth: 0.9,
        areaColor: colors.mapArea,
      },
      emphasis: {
        itemStyle: {
          areaColor: colors.mapAreaHover,
        },
      },
    },
    series: [
      {
        type: "lines",
        coordinateSystem: "geo",
        zlevel: 1,
        blendMode: "lighter",
        effect: {
          show: true,
          period: 4.6,
          trailLength: 0.18,
          symbol: "circle",
          symbolSize: 5,
          color: colors.lineEffect,
        },
        lineStyle: {
          color: colors.lineColor,
          width: 1.4,
          opacity: 0.9,
          curveness: 0.28,
          shadowBlur: 8,
          shadowColor: colors.lineShadow,
        },
        data: lineData,
      },
      {
        type: "scatter",
        coordinateSystem: "geo",
        zlevel: 3,
        symbolSize: 16,
        itemStyle: {
          color: colors.userPoint,
          borderColor: colors.userPointBorder,
          borderWidth: 3,
          shadowBlur: 22,
          shadowColor: colors.userShadow,
        },
        label: {
          show: true,
          position: userLabelPlacement.position,
          offset: userLabelPlacement.offset,
          color: colors.userLabelText,
          fontSize: window.innerWidth < 640 ? 11 : 13,
          fontWeight: 700,
          formatter: (params: any) =>
            userLabelPlacement.position === "left"
              ? `${params.name} →`
              : `← ${params.name}`,
          backgroundColor: colors.userLabelBackground,
          borderColor: colors.userLabelBorder,
          borderWidth: 1,
          padding: [5, 9],
          borderRadius: 999,
        },
        data: props.userLocation ? [props.userLocation] : [],
      },
      {
        type: "effectScatter",
        coordinateSystem: "geo",
        zlevel: 2,
        rippleEffect: {
          scale: 4.1,
          brushType: "stroke",
        },
        showEffectOn: "render",
        symbolSize: (value: number[]) =>
          9 + Math.min(Number(value[2] || 1) * 2.2, 18),
        itemStyle: {
          color: colors.nodePoint,
          borderColor: colors.nodePointBorder,
          borderWidth: 2,
          shadowBlur: 18,
          shadowColor: colors.nodeShadow,
        },
        label: {
          show: false,
          position: "right",
          offset: [12, 0],
          color: colors.nodeLabelText,
          fontSize: 14,
          fontWeight: 700,
          formatter: "{b}",
        },
        emphasis: {
          scale: false,
          label: { show: false },
        },
        data: getScatterData(props.points),
        animationDelay: (idx: number) => idx * 60,
      },
    ],
  };
}

function closePopover() {
  pickedPoint.value = null;
}

function selectNodeFromPopover(nodeId: string) {
  emit("select-node", nodeId);
  closePopover();
}

function popoverCountryName(point: MapPoint) {
  const iso = point.isoCode ?? "";
  const englishName = cnameMap.get(iso) ?? iso;
  return getDisplayCountryName(englishName || point.region, locale.value);
}

async function initChart() {
  if (!chartEl.value) return;
  loading.value = true;
  loadError.value = "";

  try {
    const geoJson = await fetch(WORLD_MAP_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`failed to load world map: ${response.status}`);
      }
      return response.json();
    });

    cnameMap.clear();
    for (const f of (geoJson as any).features ?? []) {
      if (f.properties?.name && f.properties?.cname)
        cnameMap.set(f.properties.name, f.properties.cname);
    }
    echarts.registerMap("world", geoJson);
    chart = echarts.init(chartEl.value, null, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    chart.setOption(buildOption());
    lastPointsSignature = `${getPointsSignature(props.points)}|${JSON.stringify(props.userLocation ?? null)}|${JSON.stringify(props.unlockedCountries ?? [])}|${props.selectedNodeId ?? ""}`;
    chart.on("click", (params) => {
      if (params.seriesType === "effectScatter") {
        const data = params.data as MapPoint | undefined;
        if (!data) return;
        const ex: number = (params as any).event?.offsetX ?? 0;
        const ey: number = (params as any).event?.offsetY ?? 0;
        const cw = chartEl.value?.offsetWidth ?? 800;
        const ch = chartEl.value?.offsetHeight ?? 500;
        const POP_W = 264;
        const POP_H = 220;
        const GAP = 14;
        let x = ex + GAP;
        let y = ey + GAP;
        if (x + POP_W > cw - 8) x = ex - POP_W - GAP;
        if (y + POP_H > ch - 8) y = ey - POP_H - GAP;
        popoverPos.value = { x: Math.max(8, x), y: Math.max(8, y) };
        pickedPoint.value = data;
      } else {
        pickedPoint.value = null;
      }
    });
    // 点击海洋/空白区域（不命中任何 series）时关闭 popover
    chart.getZr().on("click", () => {
      pickedPoint.value = null;
    });
  } catch (error) {
    console.error("[FlatWorldMap] Failed to load world map:", error);
    loadError.value = t("dashboard.map.loadFailed");
  } finally {
    loading.value = false;
  }
}

function onResize() {
  chart?.resize();
}

onMounted(async () => {
  await nextTick();
  initChart();
  if (typeof ResizeObserver !== "undefined" && chartEl.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(chartEl.value);
  } else {
    window.addEventListener("resize", onResize);
  }
});

watch(
  () =>
    [
      props.points,
      props.userLocation,
      props.selectedNodeId,
      props.unlockedCountries,
    ] as const,
  ([points, userLocation, selectedNodeId, unlockedCountries]) => {
    if (!chart) return;
    const colors = palette.value;
    const nextSignature = getPointsSignature(points);
    const userSignature = JSON.stringify(userLocation ?? null);
    const combinedSignature = `${nextSignature}|${userSignature}|${JSON.stringify(unlockedCountries ?? [])}|${selectedNodeId ?? ""}`;
    if (combinedSignature === lastPointsSignature) return;
    lastPointsSignature = combinedSignature;
    chart.setOption({
      geo: {
        regions: buildGeoRegions(unlockedCountries ?? []),
      },
      series: [
        { data: getLineData(points, userLocation) },
        {
          data: userLocation ? [userLocation] : [],
          label: {
            position: getUserLabelPlacement(userLocation).position,
            offset: getUserLabelPlacement(userLocation).offset,
            formatter: (params: any) =>
              getUserLabelPlacement(userLocation).position === "left"
                ? `${params.name} →`
                : `← ${params.name}`,
          },
        },
        { data: getScatterData(points) },
      ],
    });
  },
  { deep: true },
);

watch(
  () => themeStore.isDark,
  () => {
    if (!chart) return;
    chart.setOption(buildOption(), true);
    lastPointsSignature = `${getPointsSignature(props.points)}|${JSON.stringify(props.userLocation ?? null)}|${JSON.stringify(props.unlockedCountries ?? [])}|${props.selectedNodeId ?? ""}`;
  },
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("resize", onResize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div
    class="map-shell relative overflow-hidden rounded-[1.4rem] border"
    :class="shellClass"
  >
    <div class="map-grid pointer-events-none absolute inset-0 z-0" />
    <div class="map-vignette pointer-events-none absolute inset-0 z-0" />
    <div
      class="pointer-events-none absolute top-[0.9rem] left-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-tl-[0.6rem] border-t-2 border-l-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute top-[0.9rem] right-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-tr-[0.6rem] border-t-2 border-r-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute bottom-[0.9rem] left-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-bl-[0.6rem] border-b-2 border-l-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute right-[0.9rem] bottom-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-br-[0.6rem] border-r-2 border-b-2"
      :class="frameClass"
    />
    <div
      ref="chartEl"
      class="relative z-[1] aspect-[5/3] w-full md:aspect-auto md:h-[540px]"
    />

    <Transition name="map-popover">
      <div
        v-if="pickedPoint"
        class="absolute z-20 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
        :style="{ left: `${popoverPos.x}px`, top: `${popoverPos.y}px` }"
        @click.stop
        @mousedown.stop
      >
        <div
          class="flex items-center gap-2 border-b border-border/70 px-3 py-2.5"
        >
          <div class="min-w-0 flex-1">
            <div
              class="flex items-baseline gap-1.5 truncate text-sm leading-tight font-semibold"
            >
              <span class="truncate">{{
                popoverCountryName(pickedPoint)
              }}</span>
              <span
                v-if="pickedPoint.isoCode"
                class="shrink-0 font-mono text-xs font-normal text-muted-foreground"
                >{{ pickedPoint.isoCode }}</span
              >
            </div>
            <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {{
                t("dashboard.map.tooltip.nodeCount", {
                  count: pickedPoint.count,
                })
              }}
            </div>
          </div>
          <button
            class="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            @click="closePopover"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <div class="max-h-72 overflow-auto py-1">
          <button
            v-for="(nodeName, i) in pickedPoint.nodes"
            :key="pickedPoint.nodeIds?.[i] ?? `${i}-${nodeName}`"
            type="button"
            class="group flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            @click="
              selectNodeFromPopover(pickedPoint.nodeIds?.[i] ?? pickedPoint.id)
            "
          >
            <span class="flex-1 truncate text-foreground/90">{{
              nodeName
            }}</span>
            <ChevronRight
              class="h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
            />
          </button>
        </div>
      </div>
    </Transition>

    <div
      v-if="loading || loadError"
      class="absolute inset-0 z-[2] flex items-center justify-center text-sm backdrop-blur-[8px]"
      :class="[
        overlayClass,
        loadError
          ? themeMode.overlayErrorTextClass
          : themeMode.overlayLoadingTextClass,
      ]"
    >
      {{ loadError || t("dashboard.map.loading") }}
    </div>
  </div>
</template>

<style scoped>
.map-shell {
  background:
    radial-gradient(
      circle at top,
      rgba(255, 255, 255, 0.7),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      180deg,
      rgba(244, 247, 250, 0.98) 0%,
      rgba(231, 237, 243, 0.98) 100%
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    inset 0 0 0 1px rgba(148, 163, 184, 0.12),
    0 16px 36px rgba(15, 23, 42, 0.07);
}

.map-grid {
  background-image:
    linear-gradient(rgba(100, 116, 139, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 116, 139, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.65), transparent 95%);
  opacity: 0.28;
}

.map-vignette {
  background: rgba(71, 85, 105, 0.035);
}

.map-shell.theme-dark {
  background: rgba(3, 10, 20, 0.98);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(34, 211, 238, 0.04),
    0 22px 60px rgba(2, 8, 23, 0.38);
}

.map-shell.theme-dark .map-grid {
  background-image:
    linear-gradient(rgba(103, 232, 249, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(103, 232, 249, 0.06) 1px, transparent 1px);
  opacity: 0.5;
}

.map-shell.theme-dark .map-vignette {
  background: rgba(2, 6, 23, 0.22);
}

@media (max-width: 768px) {
  .map-grid {
    background-size: 24px 24px;
  }
}

.map-popover-enter-active,
.map-popover-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  transform-origin: top left;
}

.map-popover-enter-from,
.map-popover-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
</style>
