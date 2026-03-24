<script setup lang="ts">
import { shallowRef, onMounted, onUnmounted, computed, watch } from "vue";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";
import type { TaskQueryResult } from "@/composables/useCronHistory";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

const props = defineProps<{
  data: TaskQueryResult[];
  type: "ping" | "tcp_ping";
}>();

function normalizeTs(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

function fmtTime(ts: number): string {
  const d = new Date(normalizeTs(ts));
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 所有时间点（去重、升序），作为统一 x 轴
const xLabels = computed(() => {
  const seen = new Set<string>();
  const labels: string[] = [];
  const sorted = [...props.data].sort(
    (a, b) => normalizeTs(a.timestamp) - normalizeTs(b.timestamp),
  );
  for (const r of sorted) {
    const label = fmtTime(r.timestamp);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
});

// 按 cron_source 分组，每组存 timeLabel -> latency 映射
const groupedData = computed(() => {
  const groups = new Map<string, Map<string, number | null>>();
  const sorted = [...props.data].sort(
    (a, b) => normalizeTs(a.timestamp) - normalizeTs(b.timestamp),
  );
  for (const r of sorted) {
    const key = r.cron_source ?? "未知";
    const label = fmtTime(r.timestamp);
    const latency =
      r.success &&
      r.task_event_result &&
      typeof r.task_event_result[props.type] === "number"
        ? (r.task_event_result[props.type] as number)
        : null;

    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key)!.set(label, latency);
  }
  return groups;
});

const SERIES_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

const option = computed(() => {
  const cronNames = [...groupedData.value.keys()];

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      formatter: (params: { seriesName: string; value: number | null }[]) =>
        params
          .map((p) =>
            p.value === null
              ? `${p.seriesName}: 超时`
              : `${p.seriesName}: ${p.value.toFixed(1)} ms`,
          )
          .join("<br/>"),
    },
    legend: {
      data: cronNames,
      top: 0,
      type: "scroll" as const,
    },
    grid: {
      top: cronNames.length > 0 ? 48 : 20,
      right: 20,
      bottom: 24,
      left: 65,
    },
    xAxis: {
      type: "category" as const,
      data: xLabels.value,
      axisLabel: { fontSize: 11, interval: "auto" as const },
    },
    yAxis: {
      type: "value" as const,
      name: "ms",
      min: 0,
      axisLabel: { formatter: "{value} ms", fontSize: 11 },
      splitLine: { lineStyle: { type: "dashed" as const } },
    },
    series: cronNames.map((name, i) => ({
      name,
      type: "line" as const,
      // 按统一 x 轴顺序对齐，缺失时间点填 null
      data: xLabels.value.map(
        (label) => groupedData.value.get(name)?.get(label) ?? null,
      ),
      symbol: "circle",
      symbolSize: 4,
      smooth: false,
      connectNulls: false,
      lineStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 2 },
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
    })),
  };
});

const chartRef = shallowRef<HTMLDivElement | null>(null);
const chartInstance = shallowRef<EChartsType | null>(null);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (chartRef.value) {
    chartInstance.value = echarts.init(chartRef.value);
    chartInstance.value.setOption(option.value);
    resizeObserver = new ResizeObserver(() => chartInstance.value?.resize());
    resizeObserver.observe(chartRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  chartInstance.value?.dispose();
});

watch(option, (newOption) => {
  chartInstance.value?.setOption(newOption, { notMerge: true });
});
</script>

<template>
  <div ref="chartRef" class="w-full h-full" />
</template>
