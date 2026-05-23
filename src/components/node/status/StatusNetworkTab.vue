<script setup lang="ts">
import { computed } from "vue";
import { Container, Fish, Network } from "lucide-vue-next";
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
import type { DynamicNetworkInterface } from "@/types/monitoring";

type ZoomRange = { min: number; max: number } | null;

const props = defineProps<{
  server: StatusServer;
  summary: SummarySlice;
  detail: DetailSlice;
  summaryWindows: ReadonlyArray<WindowOption>;
  detailWindows: ReadonlyArray<WindowOption>;
}>();

const selectedIface = defineModel<string>("selectedIface", { required: true });
const syncAxes = defineModel<boolean>("syncAxes", { required: true });
const zoom = defineModel<ZoomRange>("zoom", { required: true });

const onZoomUpdate = (v: ZoomRange) => {
  if (syncAxes.value) zoom.value = v;
};

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
  const interval = effectiveDetailRefresh(props.detail.windowMs, props.detail.refreshInterval);
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

const detailRefreshList = computed(() => detailRefreshOptions(props.detail.windowMs));
const detailEffectiveInterval = computed(() =>
  effectiveDetailRefresh(props.detail.windowMs, props.detail.refreshInterval),
);

// Summary chart series
const netAvgTimestamps = computed(() => props.summary.data.map((d) => d.timestamp / 1000));
const netRxAvgValues = computed(() => props.summary.data.map((d) => d.receive_speed ?? 0));
const netTxAvgValues = computed(() => props.summary.data.map((d) => d.transmit_speed ?? 0));
const maxNetSpeed = computed(() => Math.max(...netRxAvgValues.value, ...netTxAvgValues.value, 1));
const tcpConnAvgValues = computed(() => props.summary.data.map((d) => d.tcp_connections ?? 0));
const udpConnAvgValues = computed(() => props.summary.data.map((d) => d.udp_connections ?? 0));
const maxConnCount = computed(() =>
  Math.max(...tcpConnAvgValues.value, ...udpConnAvgValues.value, 1),
);

// Detail series
function getIfaceSpeed(ifaces: DynamicNetworkInterface[], type: "rx" | "tx", name: string): number {
  if (name === "all") {
    return ifaces
      .filter((i) => i.interface_name !== "lo")
      .reduce((s, i) => s + ((type === "rx" ? i.receive_speed : i.transmit_speed) || 0), 0);
  }
  const iface = ifaces.find((i) => i.interface_name === name);
  return type === "rx" ? (iface?.receive_speed ?? 0) : (iface?.transmit_speed ?? 0);
}

const netTimestamps = computed(() => props.detail.data.map((d) => d.timestamp / 1000));
const displayNetRxData = computed(() =>
  props.detail.data.map((record) =>
    getIfaceSpeed(record.network?.interfaces ?? [], "rx", selectedIface.value),
  ),
);
const displayNetTxData = computed(() =>
  props.detail.data.map((record) =>
    getIfaceSpeed(record.network?.interfaces ?? [], "tx", selectedIface.value),
  ),
);
const latestNetRecord = computed(() => {
  const data = props.detail.data;
  return data.length > 0 ? data[data.length - 1] : null;
});
const currentNetRx = computed(() =>
  getIfaceSpeed(latestNetRecord.value?.network?.interfaces ?? [], "rx", selectedIface.value),
);
const currentNetTx = computed(() =>
  getIfaceSpeed(latestNetRecord.value?.network?.interfaces ?? [], "tx", selectedIface.value),
);
const maxNetChartSpeed = computed(() =>
  Math.max(...displayNetRxData.value, ...displayNetTxData.value, 1),
);

// Interface ordering: physical NICs (eth/ens) first, container/bridge last, lo bottom
function ifacePriority(name: string): number {
  if (name === "lo") return -1;
  if (name.includes("eth")) return 10;
  if (name.includes("ens")) return 9;
  if (name.includes("veth")) return 1;
  if (name.includes("docker")) return 0;
  if (name.includes("br")) return 0;
  return 5;
}

const sortedInterfaces = computed(() => {
  const ifaces = latestNetRecord.value?.network?.interfaces ?? [];
  return [...ifaces].sort(
    (a, b) => ifacePriority(b.interface_name) - ifacePriority(a.interface_name),
  );
});
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
      @change-window="onSummaryWindowChanged"
      @change-refresh="onSummaryRefreshChanged"
    />

    <!-- Throughput chart -->
    <div>
      <div class="mb-3 flex flex-wrap items-center gap-3 font-mono text-xs">
        <span class="text-muted-foreground mr-1 text-sm font-medium">Network Throughput</span>
        <span class="status-main-text">↓ {{ formatBytes(server.receive_speed ?? 0) }}/s</span>
        <span class="status-sub-text">↑ {{ formatBytes(server.transmit_speed ?? 0) }}/s</span>
        <span v-if="server.tcp_connections != null" class="text-muted-foreground ml-auto">
          TCP {{ server.tcp_connections }} &nbsp; UDP
          {{ server.udp_connections }}
        </span>
      </div>
      <div class="relative h-[340px] w-full overflow-hidden">
        <UPlotChart
          :data="netRxAvgValues"
          :data2="netTxAvgValues"
          :timestamps="netAvgTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :max-value="maxNetSpeed"
          y-label="B/s"
          label1="Download"
          label2="Upload"
          :loading="summary.loading"
          :zoom-range="syncAxes ? zoom : undefined"
          @update:zoom-range="onZoomUpdate"
        />
      </div>
      <div class="text-muted-foreground mt-2 flex items-center gap-4 font-mono text-xs">
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: MAIN_COLOR }"></span>
          Download (↓)
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: SUB_COLOR }"></span>
          Upload (↑)
        </span>
      </div>
    </div>

    <!-- Traffic Summary -->
    <div
      v-if="server.total_received != null"
      class="text-muted-foreground flex items-center gap-6 py-1 font-mono text-xs"
    >
      <span class="flex items-center gap-1.5">
        <span class="status-main-text">↓</span> Total Received
        <span class="text-foreground ml-1">{{ formatBytes(server.total_received ?? 0) }}</span>
      </span>
      <span class="text-muted-foreground/40">|</span>
      <span class="flex items-center gap-1.5">
        <span class="status-sub-text">↑</span> Total Transmitted
        <span class="text-foreground ml-1">{{ formatBytes(server.total_transmitted ?? 0) }}</span>
      </span>
    </div>

    <!-- Connections chart -->
    <div>
      <div class="mb-3 flex flex-wrap items-center gap-3 font-mono text-xs">
        <span class="text-muted-foreground mr-1 text-sm font-medium">Connections</span>
        <span class="status-main-text">TCP {{ server.tcp_connections ?? 0 }}</span>
        <span class="status-sub-text">UDP {{ server.udp_connections ?? 0 }}</span>
      </div>
      <div class="relative h-[260px] w-full overflow-hidden">
        <UPlotChart
          :data="tcpConnAvgValues"
          :data2="udpConnAvgValues"
          :timestamps="netAvgTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :max-value="maxConnCount"
          label1="TCP"
          label2="UDP"
          :loading="summary.loading"
          :zoom-range="syncAxes ? zoom : undefined"
          @update:zoom-range="onZoomUpdate"
        />
      </div>
      <div class="text-muted-foreground mt-2 flex items-center gap-4 font-mono text-xs">
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: MAIN_COLOR }"></span>
          TCP
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: SUB_COLOR }"></span>
          UDP
        </span>
      </div>
    </div>

    <!-- Detail divider -->
    <div class="flex items-center gap-3">
      <div class="bg-border h-px flex-1"></div>
      <span class="text-muted-foreground text-xs tracking-wider uppercase">Detail</span>
      <div class="bg-border h-px flex-1"></div>
    </div>

    <StatusWindowControls
      :window-ms="detail.windowMs"
      :refresh-interval="detailEffectiveInterval"
      :window-options="detailWindows"
      :refresh-options="detailRefreshList"
      @change-window="onDetailWindowChanged"
      @change-refresh="onDetailRefreshChanged"
    />

    <!-- Network interface selector cards -->
    <div
      v-if="latestNetRecord?.network?.interfaces?.length"
      class="scrollbar-none flex gap-2 overflow-x-auto pb-1"
    >
      <!-- All -->
      <button
        @click="selectedIface = 'all'"
        :class="[
          'flex w-[120px] flex-col items-start rounded-lg border px-3 py-2.5 text-xs whitespace-nowrap transition-all',
          selectedIface === 'all'
            ? 'border-[var(--status-main-color)] bg-[var(--status-main-color)]/10'
            : 'border-border bg-muted/30 hover:bg-muted/50',
        ]"
      >
        <span
          :class="
            selectedIface === 'all'
              ? 'font-medium text-[var(--status-main-color)]'
              : 'text-foreground'
          "
          >All</span
        >
        <span class="mt-1 font-mono text-[10px]" :style="{ color: MAIN_COLOR }"
          >↑
          {{
            formatBytes(
              (latestNetRecord?.network?.interfaces ?? [])
                .filter((i) => i.interface_name !== "lo")
                .reduce((s, i) => s + (i.transmit_speed || 0), 0),
            )
          }}/s</span
        >
        <span class="font-mono text-[10px]" :style="{ color: SUB_COLOR }"
          >↓
          {{
            formatBytes(
              (latestNetRecord?.network?.interfaces ?? [])
                .filter((i) => i.interface_name !== "lo")
                .reduce((s, i) => s + (i.receive_speed || 0), 0),
            )
          }}/s</span
        >
      </button>
      <button
        v-for="iface in sortedInterfaces"
        :key="iface.interface_name"
        @click="selectedIface = iface.interface_name"
        :class="[
          'flex w-[120px] flex-col items-start rounded-lg border px-3 py-2.5 text-xs whitespace-nowrap transition-all',
          selectedIface === iface.interface_name
            ? 'border-[var(--status-main-color)] bg-[var(--status-main-color)]/10'
            : 'border-border bg-muted/30 hover:bg-muted/50',
        ]"
      >
        <span
          :class="
            selectedIface === iface.interface_name
              ? 'font-medium text-[var(--status-main-color)]'
              : 'text-foreground'
          "
          >{{ iface.interface_name }}</span
        >
        <span class="mt-1 font-mono text-[10px]" :style="{ color: MAIN_COLOR }"
          >↑ {{ formatBytes(iface.transmit_speed) }}/s</span
        >
        <span class="font-mono text-[10px]" :style="{ color: SUB_COLOR }"
          >↓ {{ formatBytes(iface.receive_speed) }}/s</span
        >
      </button>
    </div>

    <!-- Per-NIC Chart -->
    <div v-if="detail.data.length > 0">
      <div class="bg-border mb-4 h-px"></div>
      <div class="mb-3 flex items-center gap-3 font-mono text-xs">
        <span class="text-muted-foreground mr-1 text-sm font-medium">
          {{ selectedIface === "all" ? "Network Throughput" : selectedIface }}
        </span>
        <span class="status-main-text">↓ {{ formatBytes(currentNetRx) }}/s</span>
        <span class="status-sub-text">↑ {{ formatBytes(currentNetTx) }}/s</span>
        <span
          v-if="latestNetRecord?.network?.tcp_connections != null"
          class="text-muted-foreground ml-auto"
        >
          TCP {{ latestNetRecord.network.tcp_connections }} &nbsp; UDP
          {{ latestNetRecord.network.udp_connections }}
        </span>
      </div>
      <div class="relative h-[260px] w-full overflow-hidden">
        <UPlotChart
          :data="displayNetRxData"
          :data2="displayNetTxData"
          :timestamps="netTimestamps"
          :color="MAIN_COLOR"
          :color2="SUB_COLOR"
          :max-value="maxNetChartSpeed"
          y-label="B/s"
          label1="Download"
          label2="Upload"
          :loading="detail.loading"
        />
      </div>
      <div class="text-muted-foreground mt-2 flex items-center gap-4 font-mono text-xs">
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: MAIN_COLOR }"></span>
          Download (↓)
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-0.5 w-3" :style="{ backgroundColor: SUB_COLOR }"></span>
          Upload (↑)
        </span>
      </div>
    </div>

    <!-- Network Interfaces List -->
    <div v-if="latestNetRecord?.network?.interfaces?.length">
      <div class="mb-3 flex items-center gap-3">
        <div class="bg-border h-px flex-1"></div>
        <span class="text-muted-foreground text-xs tracking-wider uppercase">Interfaces</span>
        <div class="bg-border h-px flex-1"></div>
      </div>
      <div class="space-y-px">
        <div
          v-for="(iface, index) in sortedInterfaces"
          :key="index"
          @click="selectedIface = iface.interface_name"
          :class="[
            'flex cursor-pointer items-center justify-between rounded px-1 py-2.5 transition-colors',
            selectedIface === iface.interface_name
              ? 'text-[var(--status-main-color)]'
              : 'hover:bg-muted/30',
          ]"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded">
              <Fish
                v-if="iface.interface_name.startsWith('docker')"
                class="text-muted-foreground h-4 w-4"
              />
              <Container
                v-else-if="iface.interface_name.startsWith('podman')"
                class="text-muted-foreground h-4 w-4"
              />
              <Network v-else class="text-muted-foreground h-4 w-4" />
            </div>
            <div>
              <div class="text-sm font-medium">
                {{ iface.interface_name }}
              </div>
              <div class="text-muted-foreground space-x-2 font-mono text-[10px]">
                <span>↓ {{ formatBytes(iface.total_received) }}</span>
                <span>↑ {{ formatBytes(iface.total_transmitted) }}</span>
              </div>
            </div>
          </div>
          <div class="space-y-0.5 text-right font-mono text-xs">
            <div :style="{ color: MAIN_COLOR }">↓ {{ formatBytes(iface.receive_speed) }}/s</div>
            <div :style="{ color: SUB_COLOR }">↑ {{ formatBytes(iface.transmit_speed) }}/s</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
