<script setup lang="ts">
import { computed, shallowRef, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, RefreshCw, Database } from "lucide-vue-next";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType } from "echarts/core";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useThemeStore } from "@/stores/theme";
import { formatBytes } from "@/utils/format";

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const props = defineProps<{
  data: { tables: Record<string, number>; total: number } | null;
  loading: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const themeStore = useThemeStore();

const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const rows = computed(() => {
  if (!props.data) return [];
  const total = props.data.total || 1;
  return Object.entries(props.data.tables)
    .map(([name, size]) => ({ name, size, percent: (size / total) * 100 }))
    .sort((a, b) => b.size - a.size);
});

const chartRef = shallowRef<HTMLDivElement | null>(null);
const chartInstance = shallowRef<EChartsType | null>(null);
let resizeObserver: ResizeObserver | null = null;

const renderChart = () => {
  chartInstance.value?.setOption(
    {
      baseOption: {
        color: PALETTE,
        tooltip: {
          trigger: "item",
          formatter: (p: { name: string; value: number; percent: number }) =>
            `${p.name}<br/>${formatBytes(p.value)} (${p.percent.toFixed(1)}%)`,
        },
        legend: {
          type: "scroll",
          textStyle: {
            color: themeStore.isDark ? "#e5e7eb" : "#374151",
            fontSize: 12,
            lineHeight: 16,
          },
          pageIconSize: 10,
          pageIconColor: themeStore.isDark ? "#e5e7eb" : "#374151",
          pageIconInactiveColor: themeStore.isDark ? "#525252" : "#cbd5e1",
          pageTextStyle: {
            color: themeStore.isDark ? "#e5e7eb" : "#374151",
            fontSize: 12,
            lineHeight: 16,
          },
          itemHeight: 12,
        },
        series: [
          {
            type: "pie",
            itemStyle: {
              borderRadius: 4,
              borderColor: themeStore.isDark ? "#0a0a0a" : "#ffffff",
              borderWidth: 2,
            },
            label: { show: false },
            data: rows.value.map((r) => ({ name: r.name, value: r.size })),
          },
        ],
      },
      media: [
        {
          query: { minWidth: 480 },
          option: {
            legend: { orient: "vertical", right: 8, top: "middle" },
            series: [{ radius: ["45%", "70%"], center: ["35%", "50%"] }],
          },
        },
        {
          option: {
            legend: { orient: "horizontal", bottom: 4, left: "center" },
            series: [{ radius: ["38%", "62%"], center: ["50%", "42%"] }],
          },
        },
      ],
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

watch(() => [rows.value, themeStore.isDark], renderChart);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Database class="h-4 w-4" />
        {{ t("dashboard.servers.detail.storageTotal") }}:
        <span class="font-mono text-foreground">
          {{ data ? formatBytes(data.total) : "--" }}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <RefreshCw v-if="!loading" class="h-3.5 w-3.5" />
        <Loader2 v-else class="h-3.5 w-3.5 animate-spin" />
        {{ t("dashboard.servers.detail.storageRefresh") }}
      </Button>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <div ref="chartRef" class="h-[280px] rounded-md border bg-card" />
      <div class="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader class="bg-muted/30">
            <TableRow class="hover:bg-transparent">
              <TableHead>{{
                t("dashboard.servers.detail.storageTableName")
              }}</TableHead>
              <TableHead class="text-right">{{
                t("dashboard.servers.detail.storageSize")
              }}</TableHead>
              <TableHead class="text-right pr-4">{{
                t("dashboard.servers.detail.storagePercent")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="!rows.length">
              <TableCell
                colspan="3"
                class="h-32 text-center text-sm text-muted-foreground"
              >
                <Loader2 v-if="loading" class="h-5 w-5 animate-spin mx-auto" />
                <span v-else>{{
                  t("dashboard.servers.detail.storageEmpty")
                }}</span>
              </TableCell>
            </TableRow>
            <TableRow
              v-for="(row, idx) in rows"
              :key="row.name"
              class="hover:bg-muted/40"
            >
              <TableCell class="font-mono text-xs">
                <span
                  class="inline-block h-2.5 w-2.5 rounded-sm mr-2 align-middle"
                  :style="{ backgroundColor: PALETTE[idx % PALETTE.length] }"
                />
                {{ row.name }}
              </TableCell>
              <TableCell class="font-mono text-xs text-right">
                {{ formatBytes(row.size) }}
              </TableCell>
              <TableCell class="font-mono text-xs text-right pr-4">
                {{ row.percent.toFixed(1) }}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
