<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
import { useKv } from "@/composables/useKv";
import { formatBytes, formatLoad } from "@/utils/format";
import { showCpuPercent, showRamPercent, showRamText } from "@/utils/show";
import { useRoute } from "vue-router";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Database,
  HardDrive,
  Network,
  AlertCircle,
  Container,
  Fish,
} from "lucide-vue-next";
import UPlotChart from "@/components/UPlotChart.vue";
import type {
  DynamicSummaryResponseItem,
  DynamicDetailData,
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
  fetchDynamic,
} = useDynamicData();

const { servers: staticServers, connect: connectStatic } = useStaticData();

const activeTab = ref("cpu");

// Detail section state (disk / network)
const selectedDisk = ref("");
const selectedIface = ref("all");

type DetailTab = "disk" | "network";

interface DetailSectionState {
  windowMs: number;
  refreshInterval: number;
  data: DynamicDetailData[];
  loading: boolean;
  timer: ReturnType<typeof setInterval> | null;
}

function createDetailState(): DetailSectionState {
  return {
    windowMs: 5 * 60 * 1000,
    refreshInterval: 1_000,
    data: [],
    loading: false,
    timer: null,
  };
}

const detailState = ref<Record<DetailTab, DetailSectionState>>({
  disk: createDetailState(),
  network: createDetailState(),
});

// CPU detail (per-core, always fetches latest snapshot)
const cpuDetail = ref<DynamicDetailData | null>(null);

// Detail timer management
let cpuDetailTimer: ReturnType<typeof setInterval> | null = null;

const startDetailTimer = (tab: string) => {
  if (tab === "cpu") {
    stopDetailTimer("cpu");
    cpuDetailTimer = setInterval(() => fetchCpuDetail(), 1_000);
    return;
  }
  const detailTab = tab as DetailTab;
  stopDetailTimer(detailTab);
  const state = detailState.value[detailTab];
  state.timer = setInterval(
    () => fetchDetail(detailTab, false),
    detailEffectiveRefresh(detailTab),
  );
};

const stopDetailTimer = (tab: string) => {
  if (tab === "cpu") {
    if (cpuDetailTimer) {
      clearInterval(cpuDetailTimer);
      cpuDetailTimer = null;
    }
    return;
  }
  const state = detailState.value[tab as DetailTab];
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
};

const stopAllDetailTimers = () => {
  stopDetailTimer("cpu");
  (["disk", "network"] as DetailTab[]).forEach((t) => stopDetailTimer(t));
};

let cpuFetchSeq = 0;

const fetchCpuDetail = async () => {
  if (!uuid.value) return;
  const seq = ++cpuFetchSeq;
  try {
    const result = await fetchDynamic(uuid.value, ["cpu"]);
    if (seq !== cpuFetchSeq) return;
    cpuDetail.value = result.length > 0 ? (result[0] ?? null) : null;
  } catch (e) {
    if (seq !== cpuFetchSeq) return;
    console.error("[Status] Failed to fetch cpu detail:", e);
  }
};

// Memory tab reads from the `server` summary ref directly — no dynamic fetch needed
const TAB_FIELDS: Record<string, string[]> = {
  cpu: ["cpu"],
  disk: ["disk"],
  network: ["network"],
};

const detailFetchSeq: Record<DetailTab, number> = { disk: 0, network: 0 };

const fetchDetail = async (tab: DetailTab, showLoading = true) => {
  const fields = TAB_FIELDS[tab];
  if (!fields || !uuid.value) return;
  const state = detailState.value[tab];
  const seq = ++detailFetchSeq[tab];
  if (showLoading) state.loading = true;
  const now = Date.now();
  const from = now - state.windowMs;
  try {
    const result = await fetchDynamic(uuid.value, fields, {
      timestamp_from: from,
      timestamp_to: now,
    });
    if (seq !== detailFetchSeq[tab]) return;
    state.data = result;
    // Auto-select first disk if not yet selected
    if (tab === "disk" && !selectedDisk.value && result.length > 0) {
      const lastRecord = result[result.length - 1];
      if (lastRecord?.disk?.length) {
        selectedDisk.value = lastRecord.disk[0]?.name ?? "";
      }
    }
  } catch (e) {
    if (seq !== detailFetchSeq[tab]) return;
    console.error(`[Status] Failed to fetch ${tab} detail data:`, e);
  } finally {
    if (showLoading) state.loading = false;
  }
};

// Format MHz → GHz
const formatMHz = (mhz: number): string => {
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${mhz} MHz`;
};

// Disk data helpers
const getDiskSpeed = (
  disks: any[],
  type: "read" | "write",
  name: string,
): number => {
  const disk = disks.find((d) => d.name === name);
  return type === "read" ? (disk?.read_speed ?? 0) : (disk?.write_speed ?? 0);
};

const diskData = computed(() => detailState.value.disk.data);

const displayDiskReadData = computed(() =>
  diskData.value.map((record) =>
    getDiskSpeed(record.disk ?? [], "read", selectedDisk.value),
  ),
);
const displayDiskWriteData = computed(() =>
  diskData.value.map((record) =>
    getDiskSpeed(record.disk ?? [], "write", selectedDisk.value),
  ),
);
const diskTimestamps = computed(() =>
  diskData.value.map((d) => d.timestamp / 1000),
);

const latestDiskRecord = computed(() => {
  const data = diskData.value;
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

// Network data helpers
const getIfaceSpeed = (
  ifaces: any[],
  type: "rx" | "tx",
  name: string,
): number => {
  if (name === "all") {
    return ifaces
      .filter((i) => i.interface_name !== "lo")
      .reduce(
        (s, i) =>
          s + ((type === "rx" ? i.receive_speed : i.transmit_speed) || 0),
        0,
      );
  }
  const iface = ifaces.find((i) => i.interface_name === name);
  return type === "rx"
    ? (iface?.receive_speed ?? 0)
    : (iface?.transmit_speed ?? 0);
};

const netData = computed(() => detailState.value.network.data);

const displayNetRxData = computed(() =>
  netData.value.map((record) =>
    getIfaceSpeed(record.network?.interfaces ?? [], "rx", selectedIface.value),
  ),
);
const displayNetTxData = computed(() =>
  netData.value.map((record) =>
    getIfaceSpeed(record.network?.interfaces ?? [], "tx", selectedIface.value),
  ),
);
const netTimestamps = computed(() =>
  netData.value.map((d) => d.timestamp / 1000),
);

const latestNetRecord = computed(() => {
  const data = netData.value;
  return data.length > 0 ? data[data.length - 1] : null;
});

const currentNetRx = computed(() =>
  getIfaceSpeed(
    latestNetRecord.value?.network?.interfaces ?? [],
    "rx",
    selectedIface.value,
  ),
);
const currentNetTx = computed(() =>
  getIfaceSpeed(
    latestNetRecord.value?.network?.interfaces ?? [],
    "tx",
    selectedIface.value,
  ),
);

const maxNetChartSpeed = computed(() =>
  Math.max(...displayNetRxData.value, ...displayNetTxData.value, 1),
);

// Network interface sorting and icons
const ifacePriority = (name: string): number => {
  if (name === "lo") return -1;
  if (name.includes("eth")) return 10;
  if (name.includes("ens")) return 9;
  if (name.includes("veth")) return 1;
  if (name.includes("docker")) return 0;
  if (name.includes("br")) return 0;
  return 5;
};

const sortedInterfaces = computed(() => {
  const ifaces = latestNetRecord.value?.network?.interfaces ?? [];
  return [...ifaces].sort(
    (a, b) => ifacePriority(b.interface_name) - ifacePriority(a.interface_name),
  );
});

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

const WINDOWS = [
  { label: "7天", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1天", value: 24 * 60 * 60 * 1000 },
  { label: "12小时", value: 12 * 60 * 60 * 1000 },
  { label: "6小时", value: 6 * 60 * 60 * 1000 },
  { label: "1小时", value: 60 * 60 * 1000 },
  { label: "30分钟", value: 30 * 60 * 1000 },
  { label: "5分钟", value: 5 * 60 * 1000 },
  { label: "3分钟", value: 3 * 60 * 1000 },
  { label: "1分钟", value: 1 * 60 * 1000 },
] as const;

const REFRESH_INTERVALS = [
  { label: "1秒", value: 1_000 },
  { label: "2秒", value: 2_000 },
  { label: "5秒", value: 5_000 },
  { label: "10秒", value: 10_000 },
  { label: "30秒", value: 30_000 },
] as const;

// Database limits from agent KV
const DEFAULT_DYNAMIC_LIMIT = 21_600_000; // 6h
const DEFAULT_SUMMARY_LIMIT = 2_592_000_000; // 30d

const kv = useKv();
const dynamicLimit = ref(DEFAULT_DYNAMIC_LIMIT);
const summaryLimit = ref(DEFAULT_SUMMARY_LIMIT);

const fetchDatabaseLimits = async () => {
  if (!uuid.value) return;
  try {
    kv.namespace.value = uuid.value;
    const [dyn, sum] = await Promise.all([
      kv.getValue("database_limit_dynamic_monitoring"),
      kv.getValue("database_limit_dynamic_monitoring_summary"),
    ]);
    if (typeof dyn === "number" && dyn > 0) dynamicLimit.value = dyn;
    else dynamicLimit.value = DEFAULT_DYNAMIC_LIMIT;
    if (typeof sum === "number" && sum > 0) summaryLimit.value = sum;
    else summaryLimit.value = DEFAULT_SUMMARY_LIMIT;
  } catch (e) {
    console.error("[Status] Failed to fetch database limits:", e);
  }
};

const summaryWindows = computed(() =>
  WINDOWS.filter((w) => w.value <= summaryLimit.value),
);
const detailWindows = computed(() =>
  WINDOWS.filter((w) => w.value <= dynamicLimit.value),
);

// Detail sections: window <= 5min allows 1s refresh; > 5min enforces minimum 10s
const detailMinRefresh = (windowMs: number) =>
  windowMs > 5 * 60 * 1000 ? 10_000 : 1_000;

const detailRefreshOptions = (windowMs: number) => {
  const min = detailMinRefresh(windowMs);
  return REFRESH_INTERVALS.filter((r) => r.value >= min);
};

const detailEffectiveRefresh = (tab: DetailTab) => {
  const s = detailState.value[tab];
  return Math.max(s.refreshInterval, detailMinRefresh(s.windowMs));
};

type TabId = "cpu" | "memory" | "disk" | "network";

interface TabAvgState {
  windowMs: number;
  refreshInterval: number;
  data: DynamicSummaryResponseItem[];
  loading: boolean;
  timer: ReturnType<typeof setInterval> | null;
}

function createTabState(): TabAvgState {
  return {
    windowMs: 6 * 60 * 60 * 1000,
    refreshInterval: 10_000,
    data: [],
    loading: false,
    timer: null,
  };
}

const tabState = ref<Record<TabId, TabAvgState>>({
  cpu: createTabState(),
  memory: createTabState(),
  disk: createTabState(),
  network: createTabState(),
});

const TAB_FIELDS_AVG: Record<TabId, SummaryField[]> = {
  cpu: ["cpu_usage"],
  memory: ["used_memory", "total_memory"],
  disk: ["read_speed", "write_speed"],
  network: ["transmit_speed", "receive_speed"],
};

const fetchTabAvg = async (tab: TabId, showLoading = true) => {
  const state = tabState.value[tab];
  if (!uuid.value) return;
  if (showLoading) state.loading = true;
  const now = Date.now();
  const from = now - state.windowMs;
  try {
    const result = await fetchSummaryAvg(
      uuid.value,
      { timestamp_from: from, timestamp_to: now },
      TAB_FIELDS_AVG[tab],
    );
    if (Array.isArray(result)) {
      state.data = result;
    }
  } catch (e: any) {
    console.error(`[Status] Failed to fetch ${tab} avg data:`, e);
    toast.error("数据查询失败", {
      description: typeof e === "string" ? e : e.message || JSON.stringify(e),
    });
  } finally {
    if (showLoading) state.loading = false;
  }
};

const startTabTimer = (tab: TabId) => {
  stopTabTimer(tab);
  const state = tabState.value[tab];
  state.timer = setInterval(
    () => fetchTabAvg(tab, false),
    state.refreshInterval,
  );
};

const stopTabTimer = (tab: TabId) => {
  const state = tabState.value[tab];
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
};

const stopAllTabTimers = () => {
  (Object.keys(tabState.value) as TabId[]).forEach(stopTabTimer);
};

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
  stopAllTabTimers();
  stopAllDetailTimers();
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

onMounted(() => {
  connectDynamic();
  connectStatic();
  fetchDatabaseLimits();
});

// On connect: fetch active tab avg + start its timer + start detail timer
watch(
  dynamicStatus,
  (status) => {
    if (status === "connected") {
      fetchTabAvg(activeTab.value as TabId);
      startTabTimer(activeTab.value as TabId);
      if (activeTab.value === "cpu") fetchCpuDetail();
      else fetchDetail(activeTab.value as DetailTab);
      startDetailTimer(activeTab.value);
    } else {
      stopAllTabTimers();
      stopAllDetailTimers();
    }
  },
  { immediate: true },
);

// Tab switch: stop old tab timer, start new tab timer, fetch new detail
watch(activeTab, (newTab, oldTab) => {
  if (oldTab) {
    stopTabTimer(oldTab as TabId);
    stopDetailTimer(oldTab);
  }
  if (dynamicStatus.value === "connected") {
    fetchTabAvg(newTab as TabId);
    startTabTimer(newTab as TabId);
    if (newTab === "cpu") fetchCpuDetail();
    else if (newTab === "disk" || newTab === "network") fetchDetail(newTab);
    startDetailTimer(newTab);
  }
});

// Node switch: clear all detail state & re-fetch limits
watch(uuid, () => {
  cpuDetail.value = null;
  detailState.value.disk.data = [];
  detailState.value.network.data = [];
  selectedDisk.value = "";
  selectedIface.value = "all";
  stopAllTabTimers();
  stopAllDetailTimers();
  (Object.keys(tabState.value) as TabId[]).forEach((tab) => {
    tabState.value[tab].data = [];
  });
  fetchDatabaseLimits();
});

// Clamp windowMs when limits change
watch([summaryLimit, dynamicLimit], () => {
  const clampWindow = (current: number, max: number) => {
    if (current > max) {
      const best = [...WINDOWS].reverse().find((w) => w.value <= max);
      return best?.value ?? WINDOWS[WINDOWS.length - 1]!.value;
    }
    return current;
  };
  (Object.keys(tabState.value) as TabId[]).forEach((tab) => {
    tabState.value[tab].windowMs = clampWindow(
      tabState.value[tab].windowMs,
      summaryLimit.value,
    );
  });
  (["disk", "network"] as DetailTab[]).forEach((tab) => {
    detailState.value[tab].windowMs = clampWindow(
      detailState.value[tab].windowMs,
      dynamicLimit.value,
    );
  });
});

// CPU chart data
const cpuAvgTimestamps = computed(() =>
  tabState.value.cpu.data.map((d) => d.timestamp / 1000),
);
const cpuAvgValues = computed(() =>
  tabState.value.cpu.data.map((d) => d.cpu_usage ?? 0),
);

// Memory chart data
const ramAvgTimestamps = computed(() =>
  tabState.value.memory.data.map((d) => d.timestamp / 1000),
);
const ramAvgValues = computed(() =>
  tabState.value.memory.data.map((d) => {
    const used = d.used_memory ?? 0;
    const total = d.total_memory ?? 1;
    return (used / total) * 100;
  }),
);

// Disk chart data
const diskAvgTimestamps = computed(() =>
  tabState.value.disk.data.map((d) => d.timestamp / 1000),
);
const diskReadAvgValues = computed(() =>
  tabState.value.disk.data.map((d) => d.read_speed ?? 0),
);
const diskWriteAvgValues = computed(() =>
  tabState.value.disk.data.map((d) => d.write_speed ?? 0),
);
const maxDiskSpeed = computed(() =>
  Math.max(...diskReadAvgValues.value, ...diskWriteAvgValues.value, 1),
);

// Network chart data
const netAvgTimestamps = computed(() =>
  tabState.value.network.data.map((d) => d.timestamp / 1000),
);
const netRxAvgValues = computed(() =>
  tabState.value.network.data.map((d) => d.receive_speed ?? 0),
);
const netTxAvgValues = computed(() =>
  tabState.value.network.data.map((d) => d.transmit_speed ?? 0),
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
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="tabState.cpu.windowMs"
                  @change="
                    tabState.cpu.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchTabAvg('cpu');
                    startTabTimer('cpu');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in summaryWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="tabState.cpu.refreshInterval"
                  @change="
                    tabState.cpu.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startTabTimer('cpu');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in REFRESH_INTERVALS"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>
            <div>
              <div
                class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap"
              >
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
                  :maxValue="100"
                  yLabel="%"
                  :loading="tabState.cpu.loading"
                />
              </div>
            </div>

            <!-- CPU Detail: per-core -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-border"></div>
              <span
                class="text-xs text-muted-foreground uppercase tracking-wider"
                >Per Core</span
              >
              <div class="h-px flex-1 bg-border"></div>
            </div>

            <div v-if="!cpuDetail" class="grid grid-cols-4 gap-2 animate-pulse">
              <div
                v-for="i in 8"
                :key="i"
                class="h-16 bg-muted rounded-lg"
              ></div>
            </div>
            <div
              v-else-if="cpuDetail?.cpu?.per_core?.length"
              class="grid grid-cols-4 gap-2"
            >
              <div
                v-for="core in cpuDetail.cpu.per_core"
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

          <!-- Memory View -->
          <div
            v-else-if="activeTab === 'memory'"
            key="memory"
            class="space-y-6"
          >
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="tabState.memory.windowMs"
                  @change="
                    tabState.memory.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchTabAvg('memory');
                    startTabTimer('memory');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in summaryWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="tabState.memory.refreshInterval"
                  @change="
                    tabState.memory.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startTabTimer('memory');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in REFRESH_INTERVALS"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>
            <div>
              <div
                class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap"
              >
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
              <div class="h-[340px] w-full relative overflow-hidden">
                <UPlotChart
                  :data="ramAvgValues"
                  :timestamps="ramAvgTimestamps"
                  :color="MAIN_COLOR"
                  :maxValue="100"
                  yLabel="%"
                  :loading="tabState.memory.loading"
                />
              </div>
            </div>

            <!-- Memory Detail: breakdown -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-border"></div>
              <span
                class="text-xs text-muted-foreground uppercase tracking-wider"
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
                      backgroundColor: '#a855f7',
                    }"
                  ></div>
                </div>
                <div class="flex gap-4 text-xs font-mono text-muted-foreground">
                  <span class="flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-sm"
                      style="background-color: #a855f7"
                    ></span>
                    Used {{ formatBytes(server.used_swap ?? 0) }}
                  </span>
                </div>
              </div>

              <div class="h-px bg-border"></div>

              <!-- Stat row -->
              <div class="grid grid-cols-3 gap-6 text-sm font-mono">
                <div>
                  <div
                    class="text-xs text-muted-foreground uppercase tracking-wider"
                  >
                    Total
                  </div>
                  <div class="text-base font-semibold mt-1">
                    {{ formatBytes(server.total_memory ?? 0) }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-0.5">
                    Physical RAM
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs text-muted-foreground uppercase tracking-wider"
                  >
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
                  <div
                    class="text-xs text-muted-foreground uppercase tracking-wider"
                  >
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

          <!-- Disk View -->
          <div v-else-if="activeTab === 'disk'" key="disk" class="space-y-4">
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="tabState.disk.windowMs"
                  @change="
                    tabState.disk.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchTabAvg('disk');
                    startTabTimer('disk');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in summaryWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="tabState.disk.refreshInterval"
                  @change="
                    tabState.disk.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startTabTimer('disk');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in REFRESH_INTERVALS"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>
            <div>
              <div
                class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap"
              >
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
                      formatBytes(
                        server.total_space - (server.available_space ?? 0),
                      )
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
                  :maxValue="maxDiskSpeed"
                  yLabel="B/s"
                  label1="Read"
                  label2="Write"
                  :loading="tabState.disk.loading"
                />
              </div>
            </div>

            <!-- Detail divider -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-border"></div>
              <span
                class="text-xs text-muted-foreground uppercase tracking-wider"
                >Detail</span
              >
              <div class="h-px flex-1 bg-border"></div>
            </div>

            <!-- Detail time window & refresh controls -->
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="detailState.disk.windowMs"
                  @change="
                    detailState.disk.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchDetail('disk');
                    startDetailTimer('disk');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in detailWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="detailEffectiveRefresh('disk')"
                  @change="
                    detailState.disk.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startDetailTimer('disk');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in detailRefreshOptions(detailState.disk.windowMs)"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>

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
                  <div
                    class="w-full h-1 bg-muted/50 rounded-full overflow-hidden"
                  >
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
                    }}% ·
                    {{ formatBytes(disk.total_space - disk.available_space) }} /
                    {{ formatBytes(disk.total_space) }}
                  </span>
                </div>
                <div class="flex gap-2 mt-1">
                  <span
                    class="font-mono text-[10px]"
                    :style="{ color: MAIN_COLOR }"
                    >↓ {{ formatBytes(disk.read_speed) }}/s</span
                  >
                  <span
                    class="font-mono text-[10px]"
                    :style="{ color: SUB_COLOR }"
                    >↑ {{ formatBytes(disk.write_speed) }}/s</span
                  >
                </div>
              </button>
            </div>

            <!-- Per-Disk I/O Chart -->
            <div v-if="selectedDisk && diskData.length > 0">
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
                  :maxValue="maxDiskChartSpeed"
                  yLabel="B/s"
                  label1="Read"
                  label2="Write"
                  :loading="detailState.disk.loading"
                />
              </div>
            </div>
          </div>

          <!-- Network View -->
          <div
            v-else-if="activeTab === 'network'"
            key="network"
            class="space-y-6"
          >
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="tabState.network.windowMs"
                  @change="
                    tabState.network.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchTabAvg('network');
                    startTabTimer('network');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in summaryWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="tabState.network.refreshInterval"
                  @change="
                    tabState.network.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startTabTimer('network');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in REFRESH_INTERVALS"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>
            <!-- Chart -->
            <div>
              <div
                class="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap"
              >
                <span class="text-sm font-medium text-muted-foreground mr-1"
                  >Network Throughput</span
                >
                <span class="status-main-text"
                  >↓ {{ formatBytes(server.receive_speed ?? 0) }}/s</span
                >
                <span class="status-sub-text"
                  >↑ {{ formatBytes(server.transmit_speed ?? 0) }}/s</span
                >
                <span
                  v-if="server.tcp_connections != null"
                  class="ml-auto text-muted-foreground"
                >
                  TCP {{ server.tcp_connections }} &nbsp; UDP
                  {{ server.udp_connections }}
                </span>
              </div>
              <div class="h-[340px] w-full relative overflow-hidden">
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
                  :loading="tabState.network.loading"
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
              </div>
            </div>

            <!-- Traffic Summary -->
            <div
              v-if="server.total_received != null"
              class="flex items-center gap-6 text-xs font-mono text-muted-foreground py-1"
            >
              <span class="flex items-center gap-1.5">
                <span class="status-main-text">↓</span> Total Received
                <span class="text-foreground ml-1">{{
                  formatBytes(server.total_received ?? 0)
                }}</span>
              </span>
              <span class="text-muted-foreground/40">|</span>
              <span class="flex items-center gap-1.5">
                <span class="status-sub-text">↑</span> Total Transmitted
                <span class="text-foreground ml-1">{{
                  formatBytes(server.total_transmitted ?? 0)
                }}</span>
              </span>
            </div>

            <!-- Detail divider -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-border"></div>
              <span
                class="text-xs text-muted-foreground uppercase tracking-wider"
                >Detail</span
              >
              <div class="h-px flex-1 bg-border"></div>
            </div>

            <!-- Detail time window & refresh controls -->
            <div class="flex items-center gap-3">
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                最近
                <select
                  :value="detailState.network.windowMs"
                  @change="
                    detailState.network.windowMs = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    fetchDetail('network');
                    startDetailTimer('network');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="w in detailWindows"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </option>
                </select>
              </span>
              <span
                class="text-xs text-muted-foreground inline-flex items-center gap-1"
              >
                每
                <select
                  :value="detailEffectiveRefresh('network')"
                  @change="
                    detailState.network.refreshInterval = +(
                      $event.target as HTMLSelectElement
                    ).value;
                    startDetailTimer('network');
                  "
                  class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
                >
                  <option
                    v-for="r in detailRefreshOptions(
                      detailState.network.windowMs,
                    )"
                    :key="r.value"
                    :value="r.value"
                  >
                    {{ r.label }}
                  </option>
                </select>
                更新
              </span>
            </div>

            <!-- Network interface selector cards -->

            <div
              v-if="latestNetRecord?.network?.interfaces?.length"
              class="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            >
              <!-- All tab -->
              <button
                @click="selectedIface = 'all'"
                :class="[
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-xs whitespace-nowrap transition-all w-[120px]',
                  selectedIface === 'all'
                    ? 'border-[var(--status-main-color)] bg-[var(--status-main-color)]/10'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                ]"
              >
                <span
                  :class="
                    selectedIface === 'all'
                      ? 'text-[var(--status-main-color)] font-medium'
                      : 'text-foreground'
                  "
                  >All</span
                >
                <span
                  class="font-mono text-[10px] mt-1"
                  :style="{ color: MAIN_COLOR }"
                  >↑
                  {{
                    formatBytes(
                      (latestNetRecord?.network?.interfaces ?? [])
                        .filter((i: any) => i.interface_name !== "lo")
                        .reduce(
                          (s: number, i: any) => s + (i.transmit_speed || 0),
                          0,
                        ),
                    )
                  }}/s</span
                >
                <span
                  class="font-mono text-[10px]"
                  :style="{ color: SUB_COLOR }"
                  >↓
                  {{
                    formatBytes(
                      (latestNetRecord?.network?.interfaces ?? [])
                        .filter((i: any) => i.interface_name !== "lo")
                        .reduce(
                          (s: number, i: any) => s + (i.receive_speed || 0),
                          0,
                        ),
                    )
                  }}/s</span
                >
              </button>
              <!-- Per-interface tabs -->
              <button
                v-for="iface in sortedInterfaces"
                :key="iface.interface_name"
                @click="selectedIface = iface.interface_name"
                :class="[
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-xs whitespace-nowrap transition-all w-[120px]',
                  selectedIface === iface.interface_name
                    ? 'border-[var(--status-main-color)] bg-[var(--status-main-color)]/10'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                ]"
              >
                <span
                  :class="
                    selectedIface === iface.interface_name
                      ? 'text-[var(--status-main-color)] font-medium'
                      : 'text-foreground'
                  "
                  >{{ iface.interface_name }}</span
                >
                <span
                  class="font-mono text-[10px] mt-1"
                  :style="{ color: MAIN_COLOR }"
                  >↑ {{ formatBytes(iface.transmit_speed) }}/s</span
                >
                <span
                  class="font-mono text-[10px]"
                  :style="{ color: SUB_COLOR }"
                  >↓ {{ formatBytes(iface.receive_speed) }}/s</span
                >
              </button>
            </div>

            <!-- Per-NIC Chart -->
            <div v-if="netData.length > 0">
              <div class="h-px bg-border mb-4"></div>
              <div class="flex items-center gap-3 mb-3 text-xs font-mono">
                <span class="text-sm font-medium text-muted-foreground mr-1">
                  {{
                    selectedIface === "all"
                      ? "Network Throughput"
                      : selectedIface
                  }}
                </span>
                <span class="status-main-text"
                  >↓ {{ formatBytes(currentNetRx) }}/s</span
                >
                <span class="status-sub-text"
                  >↑ {{ formatBytes(currentNetTx) }}/s</span
                >
                <span
                  v-if="latestNetRecord?.network?.tcp_connections != null"
                  class="ml-auto text-muted-foreground"
                >
                  TCP {{ latestNetRecord.network.tcp_connections }} &nbsp; UDP
                  {{ latestNetRecord.network.udp_connections }}
                </span>
              </div>
              <div class="h-[260px] w-full relative overflow-hidden">
                <UPlotChart
                  :data="displayNetRxData"
                  :data2="displayNetTxData"
                  :timestamps="netTimestamps"
                  :color="MAIN_COLOR"
                  :color2="SUB_COLOR"
                  :maxValue="maxNetChartSpeed"
                  yLabel="B/s"
                  label1="Download"
                  label2="Upload"
                  :loading="detailState.network.loading"
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
              </div>
            </div>

            <!-- Network Interfaces List -->
            <div v-if="latestNetRecord?.network?.interfaces?.length">
              <div class="flex items-center gap-3 mb-3">
                <div class="h-px flex-1 bg-border"></div>
                <span
                  class="text-xs text-muted-foreground uppercase tracking-wider"
                  >Interfaces</span
                >
                <div class="h-px flex-1 bg-border"></div>
              </div>
              <div class="space-y-px">
                <div
                  v-for="(iface, index) in sortedInterfaces"
                  :key="index"
                  @click="selectedIface = iface.interface_name"
                  :class="[
                    'flex items-center justify-between py-2.5 px-1 cursor-pointer transition-colors rounded',
                    selectedIface === iface.interface_name
                      ? 'text-[var(--status-main-color)]'
                      : 'hover:bg-muted/30',
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="h-7 w-7 rounded flex items-center justify-center shrink-0"
                    >
                      <Fish
                        v-if="iface.interface_name.startsWith('docker')"
                        class="h-4 w-4 text-muted-foreground"
                      />
                      <Container
                        v-else-if="iface.interface_name.startsWith('podman')"
                        class="h-4 w-4 text-muted-foreground"
                      />
                      <Network v-else class="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div class="font-medium text-sm">
                        {{ iface.interface_name }}
                      </div>
                      <div
                        class="text-[10px] text-muted-foreground font-mono space-x-2"
                      >
                        <span>↓ {{ formatBytes(iface.total_received) }}</span>
                        <span
                          >↑ {{ formatBytes(iface.total_transmitted) }}</span
                        >
                      </div>
                    </div>
                  </div>
                  <div class="text-right text-xs font-mono space-y-0.5">
                    <div :style="{ color: MAIN_COLOR }">
                      ↓ {{ formatBytes(iface.receive_speed) }}/s
                    </div>
                    <div :style="{ color: SUB_COLOR }">
                      ↑ {{ formatBytes(iface.transmit_speed) }}/s
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
