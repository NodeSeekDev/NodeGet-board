<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";
import type { PingResult } from "./usePingTask";
import {
  LATENCY_SEGMENTS,
  LOSS_COLOR,
  getLatencyColor,
} from "./pingLatencyConfig";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ results: PingResult[] }>();

const BUCKETS = [
  ...LATENCY_SEGMENTS.map((s) => ({
    label: s.label,
    min: s.min,
    max: s.max,
    color: s.color,
  })),
  { label: "丢包", min: Infinity, max: Infinity, color: LOSS_COLOR },
];

const doneResults = computed(() =>
  props.results.filter((r) => r.status === "success" || r.status === "failed"),
);

const bucketCounts = computed(() => {
  return BUCKETS.map((b) => {
    if (b.label === "丢包") {
      return props.results.filter((r) => r.loss >= 100).length;
    }
    return doneResults.value.filter(
      (r) => r.loss < 100 && r.avg !== null && r.avg >= b.min && r.avg < b.max,
    ).length;
  });
});

const stats = computed(() => {
  if (doneResults.value.length === 0)
    return { avg: null, jitter: null, lossRate: null };

  const latencies = doneResults.value
    .filter((r) => r.avg !== null && r.loss < 100)
    .map((r) => r.avg as number);
  const avg = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null;

  const jitters = doneResults.value
    .filter((r) => r.jitter !== null && r.loss < 100)
    .map((r) => r.jitter as number);
  const jitter = jitters.length
    ? jitters.reduce((a, b) => a + b, 0) / jitters.length
    : null;

  const lossRate =
    doneResults.value.reduce((a, r) => a + r.loss, 0) /
    doneResults.value.length;

  return { avg, jitter, lossRate };
});

const option = computed(() => ({
  backgroundColor: "transparent",
  grid: { top: 10, right: 10, bottom: 30, left: 40 },
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  xAxis: {
    type: "category",
    data: BUCKETS.map((b) => b.label),
    axisLabel: { fontSize: 11 },
  },
  yAxis: { type: "value", minInterval: 1 },
  series: [
    {
      type: "bar",
      data: bucketCounts.value.map((count, i) => ({
        value: count,
        itemStyle: { color: BUCKETS[i]!.color },
      })),
      barMaxWidth: 40,
    },
  ],
}));

function fmt(v: number | null, unit = "ms") {
  return v === null ? "—" : `${Math.round(v)}${unit}`;
}

function getLossRateColor(rate: number | null): string {
  if (rate === null) return "#6b7280";
  if (rate === 0) return "#26a91e";
  if (rate < 5) return "#f6ed44";
  if (rate < 20) return "#f69833";
  return "#e6170f";
}

function fmtLoss(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

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
  chartInstance.value?.setOption(newOption);
});
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="grid grid-cols-3 gap-3">
      <div class="p-3 rounded-lg border bg-card text-center">
        <div class="text-xs text-muted-foreground mb-1">平均</div>
        <div
          class="text-lg font-mono font-bold"
          :style="{ color: getLatencyColor(stats.avg, 0) }"
        >
          {{ fmt(stats.avg) }}
        </div>
      </div>
      <div class="p-3 rounded-lg border bg-card text-center">
        <div class="text-xs text-muted-foreground mb-1">抖动</div>
        <div
          class="text-lg font-mono font-bold"
          :style="{ color: getLatencyColor(stats.jitter, 0) }"
        >
          {{ fmt(stats.jitter) }}
        </div>
      </div>
      <div class="p-3 rounded-lg border bg-card text-center">
        <div class="text-xs text-muted-foreground mb-1">丢包率</div>
        <div
          class="text-lg font-mono font-bold"
          :style="{ color: getLossRateColor(stats.lossRate) }"
        >
          {{ fmtLoss(stats.lossRate) }}
        </div>
      </div>
    </div>
    <div class="flex-1 border rounded-lg bg-card overflow-hidden">
      <div ref="chartRef" class="w-full h-full" />
    </div>
  </div>
</template>
