<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
import { formatBytes, formatLoad } from "@/utils/format";
import { showCpuPercent, showRamPercent, showRamText } from "@/utils/show";
import { useRoute } from "vue-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Database,
  HardDrive,
  Network,
  AlertCircle,
} from "lucide-vue-next";
import UPlotChart from "@/components/UPlotChart.vue";
import type {
  DynamicSummaryResponseItem,
  SummaryField,
} from "@/types/monitoring";

definePage({
  meta: {
    title: "router.node.status",
  },
});

const route = useRoute();
const uuid = computed(() => (route.params as { uuid: string }).uuid);

const {
  error: dynamicError,
  status: dynamicStatus,
  servers: dynamicServers,
  connect: connectDynamic,
  fetchSummaryAvg,
} = useDynamicData();

const { servers: staticServers, connect: connectStatic } = useStaticData();

const activeTab = ref("cpu");

const notFound = computed(
  () =>
    dynamicStatus.value === "connected" &&
    dynamicServers.value.length > 0 &&
    !dynamicServers.value.find((s) => s.uuid === uuid.value),
);

const server = computed(() => {
  const dServer = dynamicServers.value.find((s) => s.uuid === uuid.value);
  const sServer = staticServers.value.find((s) => s.uuid === uuid.value);

  if (dServer) {
    return {
      ...dServer,
      system: sServer?.system,
      cpu_static: sServer?.cpu,
      gpu: sServer?.gpu || [],
    };
  }
  return undefined;
});

const tabs = [
  { id: "cpu", label: "CPU", icon: Cpu },
  { id: "memory", label: "Memory", icon: Database },
  { id: "disk", label: "Disk", icon: HardDrive },
  { id: "network", label: "Network", icon: Network },
];

const MAIN_COLOR = "#3e8eff";
const SUB_COLOR = "#e46e0a";

// Live status indicator
const lastUpdate = ref(0);
const elapsed = ref(0);
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

watch(server, (s) => {
  if (s) lastUpdate.value = Date.now();
});

onMounted(() => {
  elapsedTimer = setInterval(() => {
    elapsed.value = lastUpdate.value ? Date.now() - lastUpdate.value : Infinity;
  }, 1000);
});

onUnmounted(() => {
  if (elapsedTimer) clearInterval(elapsedTimer);
});

const liveLabel = computed(() => {
  if (!lastUpdate.value) return "";
  const secs = Math.floor(elapsed.value / 1000);
  if (secs <= 2) return "Live";
  return `Updated ${secs}s ago`;
});

const liveColor = computed(() => {
  if (!lastUpdate.value) return "";
  const secs = Math.floor(elapsed.value / 1000);
  return secs <= 2 ? "#22c55e" : "#eab308";
});

// Avg history data
const avgData = ref<DynamicSummaryResponseItem[]>([]);
const avgLoading = ref(false);

onMounted(() => {
  connectDynamic();
  connectStatic();
});

// Wait for WebSocket connected before fetching avg data
watch(
  dynamicStatus,
  (status) => {
    if (status === "connected") {
      loadAvgData();
    }
  },
  { immediate: true },
);

const loadAvgData = async () => {
  avgLoading.value = true;
  try {
    const result = await fetchSummaryAvg(uuid.value, 100, [
      "cpu_usage",
      "used_memory",
      "total_memory",
      "read_speed",
      "write_speed",
      "transmit_speed",
      "receive_speed",
    ]);
    if (Array.isArray(result)) {
      avgData.value = result;
    }
  } catch (e) {
    console.error("[Status] Failed to fetch avg data:", e);
  } finally {
    avgLoading.value = false;
  }
};

// CPU chart data from avg
const cpuAvgTimestamps = computed(() =>
  avgData.value.map((d) => d.timestamp / 1000),
);
const cpuAvgValues = computed(() => avgData.value.map((d) => d.cpu_usage ?? 0));

// Memory chart data from avg
const ramAvgTimestamps = computed(() =>
  avgData.value.map((d) => d.timestamp / 1000),
);
const ramAvgValues = computed(() =>
  avgData.value.map((d) => {
    const used = d.used_memory ?? 0;
    const total = d.total_memory ?? 1;
    return (used / total) * 100;
  }),
);

// Disk chart data from avg
const diskAvgTimestamps = computed(() =>
  avgData.value.map((d) => d.timestamp / 1000),
);
const diskReadAvgValues = computed(() =>
  avgData.value.map((d) => d.read_speed ?? 0),
);
const diskWriteAvgValues = computed(() =>
  avgData.value.map((d) => d.write_speed ?? 0),
);
const maxDiskSpeed = computed(() =>
  Math.max(...diskReadAvgValues.value, ...diskWriteAvgValues.value, 1),
);

// Network chart data from avg
const netAvgTimestamps = computed(() =>
  avgData.value.map((d) => d.timestamp / 1000),
);
const netRxAvgValues = computed(() =>
  avgData.value.map((d) => d.receive_speed ?? 0),
);
const netTxAvgValues = computed(() =>
  avgData.value.map((d) => d.transmit_speed ?? 0),
);
const maxNetSpeed = computed(() =>
  Math.max(...netRxAvgValues.value, ...netTxAvgValues.value, 1),
);
</script>

<template>
  <div
    class="flex flex-col h-full overflow-hidden status-page"
    :style="{
      '--status-main-color': MAIN_COLOR,
      '--status-sub-color': SUB_COLOR,
    }"
  >
    <!-- Tab Bar -->
    <div
      class="flex items-center gap-2 px-4 py-3 border-b shrink-0 overflow-x-auto"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all border whitespace-nowrap',
          activeTab === tab.id
            ? 'border-border bg-muted shadow-sm font-medium'
            : 'border-transparent hover:bg-muted/50 text-muted-foreground',
        ]"
      >
        <component :is="tab.icon" class="h-4 w-4" />
        <span>{{ tab.label }}</span>
      </button>
      <div class="ml-auto shrink-0">
        <Badge
          v-if="server && liveLabel"
          variant="outline"
          class="font-mono text-xs"
        >
          <span
            class="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
            :style="{ backgroundColor: liveColor }"
          ></span>
          {{ liveLabel }}
        </Badge>
      </div>
    </div>

    <!-- Main Content -->
    <div
      v-if="!server"
      class="flex-1 flex items-center justify-center text-muted-foreground"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          v-if="dynamicError"
          class="text-destructive flex items-center gap-2"
        >
          <AlertCircle class="h-5 w-5" /> {{ dynamicError }}
        </div>
        <span v-else-if="notFound">节点未找到或已离线</span>
        <span v-else>Connecting to server...</span>
      </div>
    </div>

    <div v-else class="flex-1 p-6 overflow-y-auto">
      <div class="max-w-5xl mx-auto space-y-6">
        <!-- CPU View -->
        <Transition name="fade" mode="out-in">
          <div v-if="activeTab === 'cpu'" key="cpu" class="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle class="text-sm font-medium text-muted-foreground"
                  >Total Utilization</CardTitle
                >
                <div class="flex items-center gap-3 text-xs font-mono">
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
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full flex items-end p-0 relative overflow-hidden"
                >
                  <UPlotChart
                    :data="cpuAvgValues"
                    :timestamps="cpuAvgTimestamps"
                    :color="MAIN_COLOR"
                    :maxValue="100"
                    yLabel="%"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Memory View -->
          <div
            v-else-if="activeTab === 'memory'"
            key="memory"
            class="space-y-6"
          >
            <Card>
              <CardHeader>
                <div class="flex items-center gap-4">
                  <CardTitle class="text-sm font-medium text-muted-foreground"
                    >Memory Usage</CardTitle
                  >
                  <div class="flex items-center gap-3 text-xs font-mono">
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
                          ? (
                              ((server.used_swap ?? 0) / server.total_swap) *
                              100
                            ).toFixed(1)
                          : "0.0"
                      }}%
                      <span class="ml-1">
                        {{ formatBytes(server.used_swap || 0) }} /
                        {{ formatBytes(server.total_swap || 0) }}
                      </span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full flex items-end relative overflow-hidden"
                >
                  <UPlotChart
                    :data="ramAvgValues"
                    :timestamps="ramAvgTimestamps"
                    :color="MAIN_COLOR"
                    :maxValue="100"
                    yLabel="%"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Disk View -->
          <div v-else-if="activeTab === 'disk'" key="disk" class="space-y-4">
            <Card>
              <CardHeader>
                <div class="flex items-center gap-4">
                  <CardTitle class="text-sm font-medium text-muted-foreground">
                    Disk I/O
                  </CardTitle>
                  <div class="flex items-center gap-3 text-xs font-mono">
                    <span class="status-main-text"
                      >↓ {{ formatBytes(server.read_speed ?? 0) }}/s</span
                    >
                    <span class="status-sub-text"
                      >↑ {{ formatBytes(server.write_speed ?? 0) }}/s</span
                    >
                  </div>
                  <div
                    v-if="server.total_space"
                    class="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
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
                        formatBytes(
                          server.total_space - (server.available_space ?? 0),
                        )
                      }}
                      /
                      {{ formatBytes(server.total_space) }}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full flex items-end p-0 relative overflow-hidden"
                >
                  <UPlotChart
                    :data="diskReadAvgValues"
                    :data2="diskWriteAvgValues"
                    :timestamps="diskAvgTimestamps"
                    :color="MAIN_COLOR"
                    :color2="SUB_COLOR"
                    :maxValue="maxDiskSpeed"
                    yLabel="B/s"
                    label1="Read"
                    label2="Write"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Network View -->
          <div
            v-else-if="activeTab === 'network'"
            key="network"
            class="space-y-6"
          >
            <!-- Chart Card -->
            <Card>
              <CardHeader>
                <div class="flex items-center gap-4">
                  <CardTitle class="text-sm font-medium text-muted-foreground">
                    Network Throughput
                  </CardTitle>
                  <div class="flex items-center gap-3 text-xs font-mono">
                    <span class="status-main-text"
                      >↓ {{ formatBytes(server.receive_speed ?? 0) }}/s</span
                    >
                    <span class="status-sub-text"
                      >↑ {{ formatBytes(server.transmit_speed ?? 0) }}/s</span
                    >
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full flex items-end p-0 relative overflow-hidden"
                >
                  <UPlotChart
                    :data="netRxAvgValues"
                    :data2="netTxAvgValues"
                    :timestamps="netAvgTimestamps"
                    :color="MAIN_COLOR"
                    :color2="SUB_COLOR"
                    :maxValue="maxNetSpeed"
                    yLabel="B/s"
                    label1="Download"
                    label2="Upload"
                  />
                </div>
                <!-- Legend -->
                <div
                  class="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground"
                >
                  <span class="flex items-center gap-1">
                    <span
                      class="inline-block w-3 h-0.5"
                      :style="{ backgroundColor: MAIN_COLOR }"
                    ></span>
                    Download (↓)
                  </span>
                  <span class="flex items-center gap-1">
                    <span
                      class="inline-block w-3 h-0.5"
                      :style="{ backgroundColor: SUB_COLOR }"
                    ></span>
                    Upload (↑)
                  </span>
                  <span v-if="server.tcp_connections != null" class="ml-auto">
                    TCP {{ server.tcp_connections }} &nbsp; UDP
                    {{ server.udp_connections }}
                  </span>
                </div>
              </CardContent>
            </Card>

            <!-- Traffic Summary -->
            <Card v-if="server.total_received != null">
              <CardHeader>
                <CardTitle class="text-sm font-medium text-muted-foreground">
                  Traffic Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div class="grid grid-cols-2 gap-4 text-sm font-mono">
                  <div class="flex items-center gap-2">
                    <span class="status-main-text">↓</span>
                    <span class="text-muted-foreground">Total Received</span>
                    <span class="ml-auto">{{
                      formatBytes(server.total_received ?? 0)
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="status-sub-text">↑</span>
                    <span class="text-muted-foreground">Total Transmitted</span>
                    <span class="ml-auto">{{
                      formatBytes(server.total_transmitted ?? 0)
                    }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-main-text {
  color: var(--status-main-color);
}
.status-sub-text {
  color: var(--status-sub-color);
}
</style>
