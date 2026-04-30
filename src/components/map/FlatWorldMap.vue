<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "@/stores/theme";
import { MAP_THEME } from "@/components/map/theme";
import { getDisplayCountryName } from "@/components/map/countryName";

type MapPoint = {
  id: string;
  name: string;
  region: string;
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
let chart: echarts.ECharts | null = null;
let lastPointsSignature = "";
let resizeObserver: ResizeObserver | null = null;

const WORLD_MAP_URL = `${import.meta.env.BASE_URL}geo/world.json`;

const themeMode = computed(() =>
  themeStore.isDark ? MAP_THEME.dark : MAP_THEME.light,
);
const palette = computed(() => themeMode.value.flat);

const shellClass = computed(() => themeMode.value.shellBorderClass);

const frameClass = computed(() => themeMode.value.frameClass);

const overlayClass = computed(() => themeMode.value.overlayClass);

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
    const isSelected = point.id === props.selectedNodeId;
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
          return `<b>${getDisplayCountryName(params.name, locale.value)}</b>`;
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
          const data = params.data as MapPoint | undefined;
          if (!data) return params.name;
          const nodeText =
            data.nodes.length > 0 ? data.nodes.join("<br/>") : data.name;
          return [
            `<b>${data.region || data.name}</b>`,
            t("dashboard.map.tooltip.nodeCount", { count: data.count }),
            nodeText,
          ].join("<br/>");
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
      regions: unlockedCountries.map((name) => ({
        name,
        itemStyle: {
          areaColor: colors.unlockedMapArea,
        },
        emphasis: {
          itemStyle: {
            areaColor: colors.unlockedMapAreaHover,
          },
        },
      })),
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
          label: {
            show: true,
            color: colors.emphasisLabelText,
            backgroundColor: colors.emphasisLabelBackground,
            borderColor: colors.emphasisLabelBorder,
            borderWidth: 1,
            padding: [5, 9],
            borderRadius: 999,
          },
        },
        data: getScatterData(props.points),
        animationDelay: (idx: number) => idx * 60,
      },
    ],
  };
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

    echarts.registerMap("world", geoJson);
    chart = echarts.init(chartEl.value, null, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    chart.setOption(buildOption());
    lastPointsSignature = `${getPointsSignature(props.points)}|${JSON.stringify(props.userLocation ?? null)}|${JSON.stringify(props.unlockedCountries ?? [])}|${props.selectedNodeId ?? ""}`;
    chart.on("click", (params) => {
      if (params.seriesType !== "effectScatter") return;
      const data = params.data as MapPoint | undefined;
      if (data?.id) emit("select-node", data.id);
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
        regions: (unlockedCountries ?? []).map((name) => ({
          name,
          itemStyle: {
            areaColor: colors.unlockedMapArea,
          },
          emphasis: {
            itemStyle: {
              areaColor: colors.unlockedMapAreaHover,
            },
          },
        })),
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
      class="pointer-events-none absolute left-[0.9rem] top-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-tl-[0.6rem] border-l-2 border-t-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute right-[0.9rem] top-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-tr-[0.6rem] border-r-2 border-t-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute bottom-[0.9rem] left-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-bl-[0.6rem] border-b-2 border-l-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute bottom-[0.9rem] right-[0.9rem] z-0 h-[2.8rem] w-[2.8rem] rounded-br-[0.6rem] border-b-2 border-r-2"
      :class="frameClass"
    />
    <div
      ref="chartEl"
      class="relative z-[1] aspect-[5/3] w-full md:aspect-auto md:h-[540px]"
    />
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
</style>
