<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";
import type { PingResult } from "./usePingTask";
import { LATENCY_SEGMENTS, LOSS_COLOR } from "./pingLatencyConfig";

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
  const latencies = doneResults.value
    .filter((r) => r.avg !== null && r.loss < 100)
    .map((r) => r.avg as number);
  if (latencies.length === 0) return { worst: null, best: null, avg: null };
  const worst = Math.max(...latencies);
  const best = Math.min(...latencies);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  return { worst, best, avg };
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
        <div class="text-xs text-muted-foreground mb-1">最差</div>
        <div class="text-lg font-mono font-bold text-red-500">
          {{ fmt(stats.worst) }}
        </div>
      </div>
      <div class="p-3 rounded-lg border bg-card text-center">
        <div class="text-xs text-muted-foreground mb-1">最优</div>
        <div class="text-lg font-mono font-bold text-green-500">
          {{ fmt(stats.best) }}
        </div>
      </div>
      <div class="p-3 rounded-lg border bg-card text-center">
        <div class="text-xs text-muted-foreground mb-1">平均</div>
        <div class="text-lg font-mono font-bold">{{ fmt(stats.avg) }}</div>
      </div>
    </div>
    <div class="flex-1 border rounded-lg bg-card overflow-hidden">
      <div ref="chartRef" class="w-full h-full" />
    </div>
  </div>
</template>
