<script setup lang="ts">
import { shallowRef, watch, onMounted, onUnmounted } from "vue";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";
import { useThemeStore } from "@/stores/theme";
import { formatBytes } from "@/utils/format";

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  CanvasRenderer,
]);

export type TrafficBucket = {
  label: string;
  rx: number;
  tx: number;
  total: number;
};

const props = defineProps<{
  data: TrafficBucket[];
  visibleSeries: { rx: boolean; tx: boolean; total: boolean };
}>();

const themeStore = useThemeStore();

const COLORS = { rx: "#3b82f6", tx: "#22c55e", total: "#8b5cf6" };
const NAMES = { rx: "入", tx: "出", total: "合计" };

const chartRef = shallowRef<HTMLDivElement | null>(null);
const chartInstance = shallowRef<EChartsType | null>(null);
let resizeObserver: ResizeObserver | null = null;

const renderChart = () => {
  if (!chartInstance.value) return;
  const text = themeStore.isDark ? "#e5e7eb" : "#374151";
  const grid = themeStore.isDark
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.06)";

  const visibleKeys = (["rx", "tx", "total"] as const).filter(
    (k) => props.visibleSeries[k],
  );

  chartInstance.value.setOption(
    {
      grid: { top: 16, right: 16, bottom: 28, left: 56 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (
          params: {
            axisValue: string;
            marker: string;
            seriesName: string;
            value: number;
          }[],
        ) => {
          const lines = params.map(
            (p) => `${p.marker} ${p.seriesName}: ${formatBytes(p.value)}`,
          );
          return [params[0]?.axisValue, ...lines].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: props.data.map((d) => d.label),
        axisLabel: { color: text, fontSize: 11 },
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: text,
          fontSize: 11,
          formatter: (v: number) => formatBytes(v),
        },
        splitLine: { lineStyle: { color: grid } },
      },
      series: visibleKeys.map((k) => ({
        name: NAMES[k],
        type: "bar",
        data: props.data.map((d) => d[k]),
        itemStyle: { color: COLORS[k], borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      })),
    },
    true,
  );
};

onMounted(() => {
  if (chartRef.value) {
    chartInstance.value = echarts.init(chartRef.value);
    renderChart();
    resizeObserver = new ResizeObserver(() => chartInstance.value?.resize());
    resizeObserver.observe(chartRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  chartInstance.value?.dispose();
});

watch(() => [props.data, props.visibleSeries, themeStore.isDark], renderChart, {
  deep: true,
});
</script>

<template>
  <div ref="chartRef" class="w-full h-full" />
</template>
