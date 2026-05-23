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

const ramAvgTimestamps = computed(() => props.summary.data.map((d) => d.timestamp / 1000));
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
      <div class="mb-3 flex flex-wrap items-center gap-3 font-mono text-xs">
        <span class="text-muted-foreground mr-1 text-sm font-medium">Memory Usage</span>
        <span class="status-main-text">
          RAM {{ showRamPercent(server).toFixed(1) }}%
          <span class="text-muted-foreground ml-1">{{ showRamText(server) }}</span>
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
      <div class="relative h-[340px] w-full overflow-hidden">
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
      <div class="bg-border h-px flex-1"></div>
      <span class="text-muted-foreground text-xs tracking-wider uppercase">Breakdown</span>
      <div class="bg-border h-px flex-1"></div>
    </div>

    <div class="space-y-5">
      <!-- RAM bar -->
      <div class="space-y-1.5">
        <div class="text-muted-foreground flex justify-between font-mono text-xs">
          <span>RAM</span>
          <span>{{ formatBytes(server.total_memory ?? 0) }}</span>
        </div>
        <div class="bg-muted flex h-3 overflow-hidden rounded-full">
          <div
            class="h-full rounded-full transition-all"
            :style="{
              width: `${showRamPercent(server)}%`,
              backgroundColor: MAIN_COLOR,
            }"
          ></div>
        </div>
        <div class="text-muted-foreground flex gap-4 font-mono text-xs">
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-sm" :style="{ backgroundColor: MAIN_COLOR }"></span>
            Used {{ formatBytes(server.used_memory ?? 0) }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="bg-muted border-border h-2 w-2 rounded-sm border"></span>
            Available {{ formatBytes(server.available_memory ?? 0) }}
          </span>
        </div>
      </div>

      <div class="bg-border h-px"></div>

      <!-- Swap bar -->
      <div class="space-y-1.5">
        <div class="text-muted-foreground flex justify-between font-mono text-xs">
          <span>Swap</span>
          <span>{{ formatBytes(server.total_swap ?? 0) }}</span>
        </div>
        <div class="bg-muted flex h-3 overflow-hidden rounded-full">
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
        <div class="text-muted-foreground flex gap-4 font-mono text-xs">
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-sm" :style="{ backgroundColor: SWAP_COLOR }"></span>
            Used {{ formatBytes(server.used_swap ?? 0) }}
          </span>
        </div>
      </div>

      <div class="bg-border h-px"></div>

      <!-- Stat row -->
      <div class="grid grid-cols-3 gap-6 font-mono text-sm">
        <div>
          <div class="text-muted-foreground text-xs tracking-wider uppercase">Total</div>
          <div class="mt-1 text-base font-semibold">
            {{ formatBytes(server.total_memory ?? 0) }}
          </div>
          <div class="text-muted-foreground mt-0.5 text-xs">Physical RAM</div>
        </div>
        <div>
          <div class="text-muted-foreground text-xs tracking-wider uppercase">Used</div>
          <div class="mt-1 text-base font-semibold" :style="{ color: MAIN_COLOR }">
            {{ formatBytes(server.used_memory ?? 0) }}
          </div>
          <div class="text-muted-foreground mt-0.5 text-xs">
            {{ showRamPercent(server).toFixed(1) }}%
          </div>
        </div>
        <div>
          <div class="text-muted-foreground text-xs tracking-wider uppercase">Available</div>
          <div class="mt-1 text-base font-semibold text-green-500">
            {{ formatBytes(server.available_memory ?? 0) }}
          </div>
          <div class="text-muted-foreground mt-0.5 text-xs">
            {{ (100 - showRamPercent(server)).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
