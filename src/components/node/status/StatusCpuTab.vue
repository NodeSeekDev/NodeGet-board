<script setup lang="ts">
import { computed } from "vue";
import { showCpuPercent } from "@/utils/show";
import { formatLoad } from "@/utils/format";
import UPlotChart from "@/components/UPlotChart.vue";
import StatusWindowControls from "@/components/node/status/StatusWindowControls.vue";
import {
  LOAD15_COLOR,
  MAIN_COLOR,
  REFRESH_INTERVALS,
  SUB_COLOR,
  type WindowOption,
} from "@/components/node/status/constants";
import type { SummarySlice } from "@/components/node/status/composables/useTabSummaries";
import type { CpuDetailSlice } from "@/components/node/status/composables/useTabDetails";
import type { StatusServer } from "@/components/node/status/types";

type ZoomRange = { min: number; max: number } | null;

const props = defineProps<{
  server: StatusServer;
  summary: SummarySlice;
  cpuDetail: CpuDetailSlice;
  summaryWindows: ReadonlyArray<WindowOption>;
}>();

const syncAxes = defineModel<boolean>("syncAxes", { required: true });
const zoom = defineModel<ZoomRange>("zoom", { required: true });

const onZoomUpdate = (v: ZoomRange) => {
  if (syncAxes.value) zoom.value = v;
};

function onWindowChanged(v: number) {
  props.summary.windowMs = v;
  props.summary.fetchData();
  props.summary.startTimer();
}
function onRefreshChanged(v: number) {
  props.summary.refreshInterval = v;
  props.summary.startTimer();
}

const cpuAvgTimestamps = computed(() =>
  props.summary.data.map((d) => d.timestamp / 1000),
);
const cpuAvgValues = computed(() =>
  props.summary.data.map((d) => d.cpu_usage ?? 0),
);
const load1Values = computed(() =>
  props.summary.data.map((d) => d.load_one ?? 0),
);
const load5Values = computed(() =>
  props.summary.data.map((d) => d.load_five ?? 0),
);
const load15Values = computed(() =>
  props.summary.data.map((d) => d.load_fifteen ?? 0),
);
const maxLoad = computed(() =>
  Math.max(
    ...load1Values.value,
    ...load5Values.value,
    ...load15Values.value,
    1,
  ),
);
const procValues = computed(() =>
  props.summary.data.map((d) => d.process_count ?? 0),
);
const maxProc = computed(() => Math.max(...procValues.value, 1));

function formatMHz(mhz: number): string {
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${mhz} MHz`;
}
</script>

<template>
  <div class="space-y-6">
    <StatusWindowControls
      :window-ms="summary.windowMs"
      :refresh-interval="summary.refreshInterval"
      :window-options="summaryWindows"
      :refresh-options="REFRESH_INTERVALS"
      v-model:sync-axes="syncAxes"
      :show-sync-axes="true"
      @change-window="onWindowChanged"
      @change-refresh="onRefreshChanged"
    />

    <!-- Total Utilization -->
    <div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Total Utilization</span
        >
        <span class="status-main-text">
          {{ showCpuPercent(server).toFixed(1) }}%
        </span>
        <span class="text-muted-foreground/40">|</span>
        <span class="text-muted-foreground">
          Load
          <span class="text-foreground">{{
            formatLoad({
              load_one: server.load_one,
              load_five: server.load_five,
              load_fifteen: server.load_fifteen,
            })
          }}</span>
        </span>
        <span class="text-muted-foreground/40">|</span>
        <span class="text-muted-foreground">
          {{ server.process_count ?? "-" }} Processes
        </span>
        <span class="text-muted-foreground/40">|</span>
        <span
          class="text-muted-foreground truncate max-w-[280px]"
          :title="server?.cpu_static?.per_core?.[0]?.brand"
        >
          {{ server?.cpu_static?.per_core?.[0]?.brand || "Unknown" }}
        </span>
      </div>
      <div class="h-[340px] w-full relative overflow-hidden">
        <UPlotChart
          :data="cpuAvgValues"
          :timestamps="cpuAvgTimestamps"
          :color="MAIN_COLOR"
          :max-value="100"
          y-label="%"
          :loading="summary.loading"
          :zoom-range="syncAxes ? zoom : undefined"
          @update:zoom-range="onZoomUpdate"
        />
      </div>
    </div>

    <!-- Load Average -->
    <div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Load Average</span
        >
        <span class="status-main-text"
          >1m {{ (server.load_one ?? 0).toFixed(2) }}</span
        >
        <span class="status-sub-text"
          >5m {{ (server.load_five ?? 0).toFixed(2) }}</span
        >
        <span :style="{ color: LOAD15_COLOR }"
          >15m {{ (server.load_fifteen ?? 0).toFixed(2) }}</span
        >
      </div>
      <div class="h-[260px] w-full relative overflow-hidden">
        <UPlotChart
          :data="load1Values"
          :data2="load5Values"
          :data3="load15Values"
          :timestamps="cpuAvgTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :color3="LOAD15_COLOR"
          :max-value="maxLoad"
          label1="1m"
          label2="5m"
          label3="15m"
          :loading="summary.loading"
          :zoom-range="syncAxes ? zoom : undefined"
          @update:zoom-range="onZoomUpdate"
        />
      </div>
      <div
        class="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground"
      >
        <span class="flex items-center gap-1">
          <span
            class="inline-block w-3 h-0.5"
            :style="{ backgroundColor: MAIN_COLOR }"
          ></span>
          1m
        </span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block w-3 h-0.5"
            :style="{ backgroundColor: SUB_COLOR }"
          ></span>
          5m
        </span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block w-3 h-0.5"
            :style="{ backgroundColor: LOAD15_COLOR }"
          ></span>
          15m
        </span>
      </div>
    </div>

    <!-- Processes -->
    <div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Processes</span
        >
        <span class="status-main-text">
          {{ server.process_count ?? 0 }}
        </span>
      </div>
      <div class="h-[260px] w-full relative overflow-hidden">
        <UPlotChart
          :data="procValues"
          :timestamps="cpuAvgTimestamps"
          :color="MAIN_COLOR"
          :max-value="maxProc"
          label1="Processes"
          :loading="summary.loading"
          :zoom-range="syncAxes ? zoom : undefined"
          @update:zoom-range="onZoomUpdate"
        />
      </div>
    </div>

    <!-- Per Core -->
    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-border"></div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider"
        >Per Core</span
      >
      <div class="h-px flex-1 bg-border"></div>
    </div>

    <div v-if="!cpuDetail.data" class="grid grid-cols-4 gap-2 animate-pulse">
      <div v-for="i in 8" :key="i" class="h-16 bg-muted rounded-lg"></div>
    </div>
    <div
      v-else-if="cpuDetail.data?.cpu?.per_core?.length"
      class="grid grid-cols-4 gap-2"
    >
      <div
        v-for="core in cpuDetail.data.cpu.per_core"
        :key="core.id"
        class="bg-muted/30 border border-border rounded-lg p-3 space-y-2"
      >
        <div class="text-xs text-muted-foreground font-mono">
          Core {{ core.id }}
        </div>
        <div class="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full rounded-full"
            :style="{
              width: `${core.cpu_usage}%`,
              backgroundColor: MAIN_COLOR,
            }"
          ></div>
        </div>
        <div class="flex justify-between text-xs font-mono">
          <span :style="{ color: MAIN_COLOR }"
            >{{ core.cpu_usage.toFixed(1) }}%</span
          >
          <span class="text-muted-foreground">{{
            formatMHz(core.frequency_mhz)
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
