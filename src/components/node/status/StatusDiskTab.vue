<script setup lang="ts">
import { computed } from "vue";
import { HardDrive } from "lucide-vue-next";
import { formatBytes } from "@/utils/format";
import UPlotChart from "@/components/UPlotChart.vue";
import StatusWindowControls from "@/components/node/status/StatusWindowControls.vue";
import {
  MAIN_COLOR,
  REFRESH_INTERVALS,
  SUB_COLOR,
  detailRefreshOptions,
  effectiveDetailRefresh,
  type WindowOption,
} from "@/components/node/status/constants";
import type { SummarySlice } from "@/components/node/status/composables/useTabSummaries";
import type { DetailSlice } from "@/components/node/status/composables/useTabDetails";
import type { StatusServer } from "@/components/node/status/types";

const props = defineProps<{
  server: StatusServer;
  summary: SummarySlice;
  detail: DetailSlice;
  summaryWindows: ReadonlyArray<WindowOption>;
  detailWindows: ReadonlyArray<WindowOption>;
}>();

const selectedDisk = defineModel<string>("selectedDisk", { required: true });

function onSummaryWindowChanged(v: number) {
  props.summary.windowMs = v;
  props.summary.fetchData();
  props.summary.startTimer();
}
function onSummaryRefreshChanged(v: number) {
  props.summary.refreshInterval = v;
  props.summary.startTimer();
}

function startDetailTimer() {
  const interval = effectiveDetailRefresh(
    props.detail.windowMs,
    props.detail.refreshInterval,
  );
  props.detail.startTimer(interval);
}

function onDetailWindowChanged(v: number) {
  props.detail.windowMs = v;
  props.detail.fetchData();
  startDetailTimer();
}
function onDetailRefreshChanged(v: number) {
  props.detail.refreshInterval = v;
  startDetailTimer();
}

const detailRefreshList = computed(() =>
  detailRefreshOptions(props.detail.windowMs),
);
const detailEffectiveInterval = computed(() =>
  effectiveDetailRefresh(props.detail.windowMs, props.detail.refreshInterval),
);

// Summary chart series
const diskAvgTimestamps = computed(() =>
  props.summary.data.map((d) => d.timestamp / 1000),
);
const diskReadAvgValues = computed(() =>
  props.summary.data.map((d) => d.read_speed ?? 0),
);
const diskWriteAvgValues = computed(() =>
  props.summary.data.map((d) => d.write_speed ?? 0),
);
const maxDiskSpeed = computed(() =>
  Math.max(...diskReadAvgValues.value, ...diskWriteAvgValues.value, 1),
);

// Disk detail series
function getDiskSpeed(
  disks: { name: string; read_speed: number; write_speed: number }[],
  type: "read" | "write",
  name: string,
): number {
  const disk = disks.find((d) => d.name === name);
  return type === "read" ? (disk?.read_speed ?? 0) : (disk?.write_speed ?? 0);
}

const diskTimestamps = computed(() =>
  props.detail.data.map((d) => d.timestamp / 1000),
);
const displayDiskReadData = computed(() =>
  props.detail.data.map((record) =>
    getDiskSpeed(record.disk ?? [], "read", selectedDisk.value),
  ),
);
const displayDiskWriteData = computed(() =>
  props.detail.data.map((record) =>
    getDiskSpeed(record.disk ?? [], "write", selectedDisk.value),
  ),
);
const latestDiskRecord = computed(() => {
  const data = props.detail.data;
  return data.length > 0 ? data[data.length - 1] : null;
});
const currentDiskRead = computed(() =>
  getDiskSpeed(latestDiskRecord.value?.disk ?? [], "read", selectedDisk.value),
);
const currentDiskWrite = computed(() =>
  getDiskSpeed(latestDiskRecord.value?.disk ?? [], "write", selectedDisk.value),
);
const maxDiskChartSpeed = computed(() =>
  Math.max(...displayDiskReadData.value, ...displayDiskWriteData.value, 1),
);
</script>

<template>
  <div class="space-y-4">
    <StatusWindowControls
      :window-ms="summary.windowMs"
      :refresh-interval="summary.refreshInterval"
      :window-options="summaryWindows"
      :refresh-options="REFRESH_INTERVALS"
      @change-window="onSummaryWindowChanged"
      @change-refresh="onSummaryRefreshChanged"
    />

    <div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Disk I/O</span
        >
        <span class="status-main-text"
          >↓ {{ formatBytes(server.read_speed ?? 0) }}/s</span
        >
        <span class="status-sub-text"
          >↑ {{ formatBytes(server.write_speed ?? 0) }}/s</span
        >
        <div
          v-if="server.total_space"
          class="ml-auto flex items-center gap-2 text-muted-foreground"
        >
          <HardDrive class="h-3 w-3" />
          {{
            (
              ((server.total_space - (server.available_space ?? 0)) /
                server.total_space) *
              100
            ).toFixed(0)
          }}%
          <span class="font-mono">
            {{
              formatBytes(server.total_space - (server.available_space ?? 0))
            }}
            /
            {{ formatBytes(server.total_space) }}
          </span>
        </div>
      </div>
      <div class="h-[340px] w-full relative overflow-hidden">
        <UPlotChart
          :data="diskReadAvgValues"
          :data2="diskWriteAvgValues"
          :timestamps="diskAvgTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :max-value="maxDiskSpeed"
          y-label="B/s"
          label1="Read"
          label2="Write"
          :loading="summary.loading"
        />
      </div>
    </div>

    <!-- Detail divider -->
    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-border"></div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider"
        >Detail</span
      >
      <div class="h-px flex-1 bg-border"></div>
    </div>

    <!-- Detail window+refresh controls -->
    <StatusWindowControls
      :window-ms="detail.windowMs"
      :refresh-interval="detailEffectiveInterval"
      :window-options="detailWindows"
      :refresh-options="detailRefreshList"
      @change-window="onDetailWindowChanged"
      @change-refresh="onDetailRefreshChanged"
    />

    <!-- Disk selector cards -->
    <div
      v-if="latestDiskRecord?.disk?.length"
      class="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      <button
        v-for="disk in latestDiskRecord.disk"
        :key="disk.name"
        @click="selectedDisk = disk.name"
        :class="[
          'flex flex-col items-start px-3 py-2.5 rounded-lg border text-xs whitespace-nowrap transition-all w-[300px] shrink-0',
          selectedDisk === disk.name
            ? 'border-[var(--status-main-color)] bg-[var(--status-main-color)]/10'
            : 'border-border bg-muted/30 hover:bg-muted/50',
        ]"
      >
        <span
          :class="
            selectedDisk === disk.name
              ? 'text-[var(--status-main-color)] font-medium'
              : 'text-foreground'
          "
          class="truncate w-full"
          >{{ disk.mount_point }}</span
        >
        <span
          class="text-muted-foreground text-[10px] mt-0.5 truncate w-full"
          >{{ disk.name }}</span
        >
        <div class="w-full mt-1.5">
          <div class="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :style="{
                width:
                  disk.total_space > 0
                    ? Math.min(
                        ((disk.total_space - disk.available_space) /
                          disk.total_space) *
                          100,
                        100,
                      ).toFixed(0) + '%'
                    : '0%',
                backgroundColor: MAIN_COLOR,
                opacity: selectedDisk === disk.name ? '1' : '0.5',
              }"
            ></div>
          </div>
          <span class="font-mono text-[10px] text-muted-foreground">
            {{
              disk.total_space > 0
                ? Math.round(
                    ((disk.total_space - disk.available_space) /
                      disk.total_space) *
                      100,
                  )
                : 0
            }}% · {{ formatBytes(disk.total_space - disk.available_space) }} /
            {{ formatBytes(disk.total_space) }}
          </span>
        </div>
        <div class="flex gap-2 mt-1">
          <span class="font-mono text-[10px]" :style="{ color: MAIN_COLOR }"
            >↓ {{ formatBytes(disk.read_speed) }}/s</span
          >
          <span class="font-mono text-[10px]" :style="{ color: SUB_COLOR }"
            >↑ {{ formatBytes(disk.write_speed) }}/s</span
          >
        </div>
      </button>
    </div>

    <!-- Per-Disk I/O Chart -->
    <div v-if="selectedDisk && detail.data.length > 0">
      <div class="h-px bg-border mb-4"></div>
      <div class="flex items-center gap-3 mb-3 text-xs font-mono">
        <span class="text-sm font-medium text-muted-foreground mr-1"
          >Disk I/O · {{ selectedDisk }}</span
        >
        <span class="status-main-text"
          >↓ {{ formatBytes(currentDiskRead) }}/s</span
        >
        <span class="status-sub-text"
          >↑ {{ formatBytes(currentDiskWrite) }}/s</span
        >
      </div>
      <div class="h-[260px] w-full relative overflow-hidden">
        <UPlotChart
          :data="displayDiskReadData"
          :data2="displayDiskWriteData"
          :timestamps="diskTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :max-value="maxDiskChartSpeed"
          y-label="B/s"
          label1="Read"
          label2="Write"
          :loading="detail.loading"
        />
      </div>
    </div>
  </div>
</template>
