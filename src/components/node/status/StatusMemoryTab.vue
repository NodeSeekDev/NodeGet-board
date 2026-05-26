<script setup lang="ts">
import { computed } from "vue";
import { showRamPercent, showRamText } from "@/utils/show";
import { formatBytes } from "@/utils/format";
import UPlotChart from "@/components/UPlotChart.vue";
import StatusWindowControls from "@/components/node/status/StatusWindowControls.vue";
import {
  MAIN_COLOR,
  REFRESH_INTERVALS,
  SWAP_COLOR,
  type WindowOption,
} from "@/components/node/status/constants";
import type { SummarySlice } from "@/components/node/status/composables/useTabSummaries";
import type { StatusServer } from "@/components/node/status/types";

const props = defineProps<{
  server: StatusServer;
  summary: SummarySlice;
  summaryWindows: ReadonlyArray<WindowOption>;
}>();

function onWindowChanged(v: number) {
  props.summary.windowMs = v;
  props.summary.fetchData();
  props.summary.startTimer();
}
function onRefreshChanged(v: number) {
  props.summary.refreshInterval = v;
  props.summary.startTimer();
}

const ramAvgTimestamps = computed(() =>
  props.summary.data.map((d) => d.timestamp / 1000),
);
const ramAvgValues = computed(() =>
  props.summary.data.map((d) => {
    const used = d.used_memory ?? 0;
    const total = d.total_memory ?? 1;
    return (used / total) * 100;
  }),
);
</script>

<template>
  <div class="space-y-6">
    <StatusWindowControls
      :window-ms="summary.windowMs"
      :refresh-interval="summary.refreshInterval"
      :window-options="summaryWindows"
      :refresh-options="REFRESH_INTERVALS"
      @change-window="onWindowChanged"
      @change-refresh="onRefreshChanged"
    />

    <div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Memory Usage</span
        >
        <span class="status-main-text">
          RAM {{ showRamPercent(server).toFixed(1) }}%
          <span class="text-muted-foreground ml-1">{{
            showRamText(server)
          }}</span>
        </span>
        <span class="text-muted-foreground/40">|</span>
        <span class="text-muted-foreground">
          Swap
          {{
            server.total_swap
              ? (((server.used_swap ?? 0) / server.total_swap) * 100).toFixed(1)
              : "0.0"
          }}%
          <span class="ml-1">
            {{ formatBytes(server.used_swap || 0) }} /
            {{ formatBytes(server.total_swap || 0) }}
          </span>
        </span>
      </div>
      <div class="h-[340px] w-full relative overflow-hidden">
        <UPlotChart
          :data="ramAvgValues"
          :timestamps="ramAvgTimestamps"
          :color="MAIN_COLOR"
          :max-value="100"
          y-label="%"
          :loading="summary.loading"
        />
      </div>
    </div>

    <!-- Memory Detail: breakdown -->
    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-border"></div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider"
        >Breakdown</span
      >
      <div class="h-px flex-1 bg-border"></div>
    </div>

    <div class="space-y-5">
      <!-- RAM bar -->
      <div class="space-y-1.5">
        <div
          class="flex justify-between text-xs text-muted-foreground font-mono"
        >
          <span>RAM</span>
          <span>{{ formatBytes(server.total_memory ?? 0) }}</span>
        </div>
        <div class="h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            class="h-full rounded-full transition-all"
            :style="{
              width: `${showRamPercent(server)}%`,
              backgroundColor: MAIN_COLOR,
            }"
          ></div>
        </div>
        <div class="flex gap-4 text-xs font-mono text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-sm"
              :style="{ backgroundColor: MAIN_COLOR }"
            ></span>
            Used {{ formatBytes(server.used_memory ?? 0) }}
          </span>
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-sm bg-muted border border-border"
            ></span>
            Available {{ formatBytes(server.available_memory ?? 0) }}
          </span>
        </div>
      </div>

      <div class="h-px bg-border"></div>

      <!-- Swap bar -->
      <div class="space-y-1.5">
        <div
          class="flex justify-between text-xs text-muted-foreground font-mono"
        >
          <span>Swap</span>
          <span>{{ formatBytes(server.total_swap ?? 0) }}</span>
        </div>
        <div class="h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            class="h-full rounded-full transition-all"
            :style="{
              width: server.total_swap
                ? `${((server.used_swap ?? 0) / server.total_swap) * 100}%`
                : '0%',
              backgroundColor: SWAP_COLOR,
            }"
          ></div>
        </div>
        <div class="flex gap-4 text-xs font-mono text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-sm"
              :style="{ backgroundColor: SWAP_COLOR }"
            ></span>
            Used {{ formatBytes(server.used_swap ?? 0) }}
          </span>
        </div>
      </div>

      <div class="h-px bg-border"></div>

      <!-- Stat row -->
      <div class="grid grid-cols-3 gap-6 text-sm font-mono">
        <div>
          <div class="text-xs text-muted-foreground uppercase tracking-wider">
            Total
          </div>
          <div class="text-base font-semibold mt-1">
            {{ formatBytes(server.total_memory ?? 0) }}
          </div>
          <div class="text-xs text-muted-foreground mt-0.5">Physical RAM</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground uppercase tracking-wider">
            Used
          </div>
          <div
            class="text-base font-semibold mt-1"
            :style="{ color: MAIN_COLOR }"
          >
            {{ formatBytes(server.used_memory ?? 0) }}
          </div>
          <div class="text-xs text-muted-foreground mt-0.5">
            {{ showRamPercent(server).toFixed(1) }}%
          </div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground uppercase tracking-wider">
            Available
          </div>
          <div class="text-base font-semibold mt-1 text-green-500">
            {{ formatBytes(server.available_memory ?? 0) }}
          </div>
          <div class="text-xs text-muted-foreground mt-0.5">
            {{ (100 - showRamPercent(server)).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
