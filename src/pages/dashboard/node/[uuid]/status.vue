<script setup lang="ts">
import { onMounted, computed, ref, watch } from "vue";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
import { colors } from "@/composables/color";
import {
  formatLoad,
  formatBytes,
  formatUptime,
  formatTimestamp,
} from "@/utils/format";
import {
  showCpuPercent,
  showRamPercent,
  showRamText,
  showNetworkSpeed,
  showDiskDisplay,
} from "@/utils/show";

import { useRoute } from "vue-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cpu,
  Database,
  HardDrive,
  Network,
  AlertCircle,
  Clock,
  Container,
  Fish,
} from "lucide-vue-next";

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
  fetchCpuHistory,
  fetchRamHistory,
  fetchNetworkHistory,
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

  if (dServer && sServer) {
    return {
      ...dServer,
      cpu: { ...dServer.cpu },
      cpu_static: { ...sServer.cpu },
      system: { ...sServer.system, ...dServer.system },
      gpu: sServer.gpu || [],
    };
  }
  return dServer;
});

const getcolors = (id: string) => {
  return (colors as any)[id] || colors.cpu;
};

const tabs = [
  { id: "cpu", label: "CPU", icon: Cpu },
  { id: "memory", label: "Memory", icon: Database },
  { id: "disk", label: "Disk", icon: HardDrive },
  { id: "network", label: "Network", icon: Network },
];

const activeTheme = computed(() => getcolors(activeTab.value));

onMounted(() => {
  connectDynamic();
  connectStatic();
});

const cpuHistory = ref<number[]>([]);
const cpuMode = ref("realtime");
const historyData = ref<any[]>([]);
const isLoadingHistory = ref(false);

const ramHistory = ref<number[]>([]);
const ramMode = ref("realtime");
const ramHistoryData = ref<any[]>([]);
const isLoadingRamHistory = ref(false);

const netSnapshots = ref<any[][]>([]);
const selectedIface = ref("all");
const netMode = ref("realtime");
const netHistoryData = ref<any[]>([]);
const isLoadingNetHistory = ref(false);

const diskSnapshots = ref<any[][]>([]);
const selectedDisk = ref("");

watch(server, (newServer: any) => {
  if (newServer) {
    const cpuPercent = showCpuPercent(newServer);
    cpuHistory.value.push(cpuPercent);
    if (cpuHistory.value.length > 30) {
      cpuHistory.value.shift();
    }

    const ramPercent = showRamPercent(newServer);
    ramHistory.value.push(ramPercent);
    if (ramHistory.value.length > 30) {
      ramHistory.value.shift();
    }

    const ifaces = newServer.network?.interfaces ?? [];
    netSnapshots.value.push([...ifaces]);
    if (netSnapshots.value.length > 30) netSnapshots.value.shift();

    const disks = newServer.disk ?? [];
    diskSnapshots.value.push([...disks]);
    if (diskSnapshots.value.length > 30) diskSnapshots.value.shift();
    if (!selectedDisk.value && disks.length > 0) {
      selectedDisk.value = disks[0].name;
    }
  }
});

const loadHistory = async () => {
  if (!uuid.value) return;
  isLoadingHistory.value = true;
  try {
    const res = await fetchCpuHistory(uuid.value);
    if (Array.isArray(res)) {
      historyData.value = res.reverse();
    }
  } catch (e) {
    console.error("Failed to fetch history", e);
  } finally {
    isLoadingHistory.value = false;
  }
};

watch(cpuMode, (newMode) => {
  if (newMode === "history") {
    loadHistory();
  }
});

const loadRamHistory = async () => {
  if (!uuid.value) return;
  isLoadingRamHistory.value = true;
  try {
    const res = await fetchRamHistory(uuid.value);
    if (Array.isArray(res)) {
      ramHistoryData.value = res.reverse();
    }
  } catch (e) {
    console.error("Failed to fetch ram history", e);
  } finally {
    isLoadingRamHistory.value = false;
  }
};

watch(ramMode, (newMode) => {
  if (newMode === "history") {
    loadRamHistory();
  }
});

const loadNetHistory = async () => {
  if (!uuid.value) return;
  isLoadingNetHistory.value = true;
  try {
    const res = await fetchNetworkHistory(uuid.value);
    if (Array.isArray(res)) {
      netHistoryData.value = res.reverse();
    }
  } catch (e) {
    console.error("Failed to fetch network history", e);
  } finally {
    isLoadingNetHistory.value = false;
  }
};

watch(netMode, (newMode) => {
  if (newMode === "history") {
    loadNetHistory();
  }
});

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

const currentNetRx = computed(() =>
  getIfaceSpeed(
    server.value?.network?.interfaces ?? [],
    "rx",
    selectedIface.value,
  ),
);
const currentNetTx = computed(() =>
  getIfaceSpeed(
    server.value?.network?.interfaces ?? [],
    "tx",
    selectedIface.value,
  ),
);

const displayData = computed(() => {
  if (cpuMode.value === "history") {
    return historyData.value.map((item) => item.cpu.total_cpu_usage);
  }
  return cpuHistory.value;
});

const historyPath = computed(() => {
  const data = displayData.value;
  if (data.length < 2) return "";

  const width = 100;
  const height = 40;
  const maxVal = 100;
  const pad = 2;

  const points: [number, number][] = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + (height - 2 * pad) * (1 - val / maxVal);
    return [x, y];
  });

  if (points.length < 2) return "";

  let d = `M ${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    if (!p0 || !p1 || !p2 || !p3) continue;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;

    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return d;
});

const historyAreaPath = computed(() => {
  const data = displayData.value;
  if (data.length < 2) return "";
  const path = historyPath.value;

  return `${path} L 100,40 L 0,40 Z`;
});

const displayRamData = computed(() => {
  if (ramMode.value === "history") {
    return ramHistoryData.value.map((item) => {
      const used = item.ram.used_memory ?? item.ram.used ?? 0;
      const total = item.ram.total_memory ?? item.ram.total ?? 1;
      return (used / total) * 100;
    });
  }
  return ramHistory.value;
});

const ramHistoryPath = computed(() => {
  const data = displayRamData.value;
  if (data.length < 2) return "";

  const width = 100;
  const height = 40;
  const maxVal = 100;
  const pad = 2;

  const points: [number, number][] = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + (height - 2 * pad) * (1 - val / maxVal);
    return [x, y];
  });

  if (points.length < 2) return "";

  let d = `M ${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    if (!p0 || !p1 || !p2 || !p3) continue;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;

    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return d;
});

const ramHistoryAreaPath = computed(() => {
  const data = displayRamData.value;
  if (data.length < 2) return "";
  const path = ramHistoryPath.value;

  return `${path} L 100,40 L 0,40 Z`;
});

const displayNetRxData = computed(() => {
  if (netMode.value === "history") {
    return netHistoryData.value.map((item) =>
      getIfaceSpeed(item.network?.interfaces ?? [], "rx", selectedIface.value),
    );
  }
  return netSnapshots.value.map((ifaces) =>
    getIfaceSpeed(ifaces, "rx", selectedIface.value),
  );
});

const displayNetTxData = computed(() => {
  if (netMode.value === "history") {
    return netHistoryData.value.map((item) =>
      getIfaceSpeed(item.network?.interfaces ?? [], "tx", selectedIface.value),
    );
  }
  return netSnapshots.value.map((ifaces) =>
    getIfaceSpeed(ifaces, "tx", selectedIface.value),
  );
});

const maxNetSpeed = computed(() =>
  Math.max(...displayNetRxData.value, ...displayNetTxData.value, 1),
);

const buildNetPath = (data: number[], maxVal: number): string => {
  if (data.length < 2) return "";
  const width = 100;
  const height = 40;
  const pad = 2;
  const points: [number, number][] = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + (height - 2 * pad) * (1 - val / maxVal);
    return [x, y];
  });
  if (points.length < 2) return "";
  let d = `M ${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1]!;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = Math.max(
      pad,
      Math.min(height - pad, p1[1] + (p2[1] - p0[1]) / 6),
    );
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = Math.max(
      pad,
      Math.min(height - pad, p2[1] - (p3[1] - p1[1]) / 6),
    );
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
};

const netRxPath = computed(() =>
  buildNetPath(displayNetRxData.value, maxNetSpeed.value),
);
const netTxPath = computed(() =>
  buildNetPath(displayNetTxData.value, maxNetSpeed.value),
);
const netRxAreaPath = computed(() => {
  const path = netRxPath.value;
  if (!path) return "";
  return `${path} L 100,40 L 0,40 Z`;
});

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
  if (!server.value?.network?.interfaces) return [];
  return [...server.value.network.interfaces].sort(
    (a, b) => ifacePriority(b.interface_name) - ifacePriority(a.interface_name),
  );
});

const filteredDisks = computed(() => {
  return server.value?.disk ?? [];
});

const getDiskSpeed = (
  disks: any[],
  type: "read" | "write",
  name: string,
): number => {
  const disk = disks.find((d) => d.name === name);
  return type === "read" ? (disk?.read_speed ?? 0) : (disk?.write_speed ?? 0);
};

const currentDiskRead = computed(() =>
  getDiskSpeed(server.value?.disk ?? [], "read", selectedDisk.value),
);
const currentDiskWrite = computed(() =>
  getDiskSpeed(server.value?.disk ?? [], "write", selectedDisk.value),
);

const displayDiskReadData = computed(() =>
  diskSnapshots.value.map((disks) =>
    getDiskSpeed(disks, "read", selectedDisk.value),
  ),
);
const displayDiskWriteData = computed(() =>
  diskSnapshots.value.map((disks) =>
    getDiskSpeed(disks, "write", selectedDisk.value),
  ),
);

const maxDiskSpeed = computed(() =>
  Math.max(...displayDiskReadData.value, ...displayDiskWriteData.value, 1),
);

const diskReadPath = computed(() =>
  buildNetPath(displayDiskReadData.value, maxDiskSpeed.value),
);
const diskWritePath = computed(() =>
  buildNetPath(displayDiskWriteData.value, maxDiskSpeed.value),
);
const diskReadAreaPath = computed(() => {
  const path = diskReadPath.value;
  if (!path) return "";
  return `${path} L 100,40 L 0,40 Z`;
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
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
        <Badge v-if="server" variant="outline" class="font-mono text-xs">
          <Clock class="h-3 w-3 mr-1" />
          Uptime: {{ formatUptime(server.system.uptime) }}
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

    <div
      v-else
      class="flex-1 p-6 overflow-y-auto"
      :style="{ '--primary': `hsl(${activeTheme.hsl})` }"
    >
      <div class="max-w-5xl mx-auto space-y-6">
        <!-- CPU View -->
        <Transition name="fade" mode="out-in">
          <div v-if="activeTab === 'cpu'" key="cpu" class="space-y-6">
            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle class="text-sm font-medium text-muted-foreground"
                    >Total Utilization</CardTitle
                  >
                  <Tabs v-model="cpuMode" class="w-[200px]">
                    <TabsList class="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="realtime" class="text-xs"
                        >Realtime</TabsTrigger
                      >
                      <TabsTrigger value="history" class="text-xs"
                        >History</TabsTrigger
                      >
                    </TabsList>
                  </Tabs>
                </div>
                <div class="flex items-center gap-3 text-xs font-mono">
                  <span :style="{ color: activeTheme.color }">
                    {{ showCpuPercent(server).toFixed(1) }}%
                  </span>
                  <span class="text-muted-foreground/40">|</span>
                  <span class="text-muted-foreground">
                    Load
                    <span class="text-foreground">{{
                      formatLoad(server.load)
                    }}</span>
                  </span>
                  <span class="text-muted-foreground/40">|</span>
                  <span class="text-muted-foreground">
                    {{ server.cpu.per_core.length }} Cores
                  </span>
                  <span class="text-muted-foreground/40">|</span>
                  <span
                    class="text-muted-foreground truncate max-w-[280px]"
                    :title="server?.cpu_static?.per_core?.[0]?.brand"
                  >
                    {{ server?.cpu_static?.per_core?.[0]?.brand || "Unknown" }}
                  </span>
                </div>
                <div class="h-5 flex items-center" v-if="cpuMode === 'history'">
                  <span
                    class="text-xs text-muted-foreground"
                    v-if="isLoadingHistory"
                    >Loading history...</span
                  >
                  <span
                    class="text-xs text-muted-foreground"
                    v-else-if="historyData.length > 0"
                  >
                    Last {{ historyData.length }} records
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full bg-muted/10 rounded-md border flex items-end p-0 relative overflow-hidden group"
                >
                  <!-- Axis Guide -->
                  <div
                    class="absolute inset-y-0 left-0 w-8 flex flex-col justify-between py-2 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none pl-2 z-10"
                  >
                    <div>100%</div>
                    <div>50%</div>
                    <div>0%</div>
                  </div>
                  <!-- Grid Lines -->
                  <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none z-0"
                  >
                    <div class="border-t border-border/40 opacity-50"></div>
                    <div
                      class="border-t border-border/40 border-dashed opacity-50"
                    ></div>
                    <div class="border-b border-border/40 opacity-50"></div>
                  </div>
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    class="w-full h-full text-primary"
                  >
                    <defs>
                      <linearGradient
                        id="cpuGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          :stop-color="activeTheme.color"
                          stop-opacity="0.5"
                        />
                        <stop
                          offset="100%"
                          :stop-color="activeTheme.color"
                          stop-opacity="0"
                        />
                      </linearGradient>
                      <filter
                        id="glow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <path
                      :d="historyAreaPath"
                      fill="url(#cpuGradient)"
                      stroke="none"
                    />
                    <path
                      :d="historyPath"
                      fill="none"
                      :stroke="activeTheme.color"
                      stroke-width="1.5"
                      filter="url(#glow)"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-6xl select-none pointer-events-none group-hover:opacity-0 transition-opacity"
                  >
                    {{ cpuMode === "realtime" ? "REALTIME" : "HISTORY" }}
                  </div>
                  <div
                    v-if="cpuMode === 'history' && historyData.length > 0"
                    class="absolute bottom-1 left-12 text-[10px] text-muted-foreground font-mono"
                  >
                    {{ formatTimestamp(historyData[0].timestamp) }}
                  </div>
                  <div
                    v-if="cpuMode === 'history' && historyData.length > 0"
                    class="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono"
                  >
                    {{
                      formatTimestamp(
                        historyData[historyData.length - 1].timestamp,
                      )
                    }}
                  </div>
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
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <CardTitle class="text-sm font-medium text-muted-foreground"
                      >Memory Usage</CardTitle
                    >
                    <div class="flex items-center gap-3 text-xs font-mono">
                      <span :style="{ color: activeTheme.color }">
                        RAM {{ showRamPercent(server).toFixed(1) }}%
                        <span class="text-muted-foreground ml-1">{{
                          showRamText(server)
                        }}</span>
                      </span>
                      <span class="text-muted-foreground/40">|</span>
                      <span class="text-muted-foreground">
                        Swap
                        {{
                          server.ram.total_swap
                            ? (
                                (server.ram.used_swap / server.ram.total_swap) *
                                100
                              ).toFixed(1)
                            : "0.0"
                        }}%
                        <span class="ml-1">
                          {{ formatBytes(server.ram.used_swap || 0) }} /
                          {{ formatBytes(server.ram.total_swap || 0) }}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Tabs v-model="ramMode" class="w-[200px]">
                    <TabsList class="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="realtime" class="text-xs"
                        >Realtime</TabsTrigger
                      >
                      <TabsTrigger value="history" class="text-xs"
                        >History</TabsTrigger
                      >
                    </TabsList>
                  </Tabs>
                </div>
                <div class="h-5 flex items-center" v-if="ramMode === 'history'">
                  <span
                    class="text-xs text-muted-foreground"
                    v-if="isLoadingRamHistory"
                    >Loading history...</span
                  >
                  <span
                    class="text-xs text-muted-foreground"
                    v-else-if="ramHistoryData.length > 0"
                  >
                    Last {{ ramHistoryData.length }} records
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full bg-muted/10 rounded-md border flex items-end p-0 relative overflow-hidden group"
                >
                  <div
                    class="absolute inset-y-0 left-0 w-8 flex flex-col justify-between py-2 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none pl-2 z-10"
                  >
                    <div>100%</div>
                    <div>50%</div>
                    <div>0%</div>
                  </div>
                  <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none z-0"
                  >
                    <div class="border-t border-border/40 opacity-50"></div>
                    <div
                      class="border-t border-border/40 border-dashed opacity-50"
                    ></div>
                    <div class="border-b border-border/40 opacity-50"></div>
                  </div>
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    class="w-full h-full text-primary"
                  >
                    <defs>
                      <linearGradient
                        id="ramGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          :stop-color="activeTheme.color"
                          stop-opacity="0.5"
                        />
                        <stop
                          offset="100%"
                          :stop-color="activeTheme.color"
                          stop-opacity="0"
                        />
                      </linearGradient>
                      <filter
                        id="ramGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <path
                      :d="ramHistoryAreaPath"
                      fill="url(#ramGradient)"
                      stroke="none"
                    />
                    <path
                      :d="ramHistoryPath"
                      fill="none"
                      :stroke="activeTheme.color"
                      stroke-width="1.5"
                      filter="url(#ramGlow)"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-6xl select-none pointer-events-none group-hover:opacity-0 transition-opacity"
                  >
                    {{ ramMode === "realtime" ? "REALTIME" : "HISTORY" }}
                  </div>
                  <div
                    v-if="ramMode === 'history' && ramHistoryData.length > 0"
                    class="absolute bottom-1 left-12 text-[10px] text-muted-foreground font-mono"
                  >
                    {{ formatTimestamp(ramHistoryData[0].timestamp) }}
                  </div>
                  <div
                    v-if="ramMode === 'history' && ramHistoryData.length > 0"
                    class="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono"
                  >
                    {{
                      formatTimestamp(
                        ramHistoryData[ramHistoryData.length - 1].timestamp,
                      )
                    }}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div v-else-if="activeTab === 'disk'" key="disk" class="space-y-4">
            <!-- Disk Tab Bar -->
            <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                v-for="disk in filteredDisks"
                :key="disk.name"
                @click="selectedDisk = disk.name"
                :class="[
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-xs whitespace-nowrap transition-all w-[300px] shrink-0',
                  selectedDisk === disk.name
                    ? 'border-[#fb7185] bg-[#fb7185]/10'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                ]"
              >
                <span
                  :class="
                    selectedDisk === disk.name
                      ? 'text-[#fb7185] font-medium'
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
                          (
                            (1 - disk.available_space / disk.total_space) *
                            100
                          ).toFixed(0) + '%',
                        backgroundColor: '#fb7185',
                        opacity: selectedDisk === disk.name ? '1' : '0.5',
                      }"
                    ></div>
                  </div>
                  <span class="font-mono text-[10px] text-muted-foreground">
                    {{
                      (
                        (1 - disk.available_space / disk.total_space) *
                        100
                      ).toFixed(0)
                    }}% ·
                    {{ formatBytes(disk.total_space - disk.available_space) }} /
                    {{ formatBytes(disk.total_space) }}
                  </span>
                </div>
                <div class="flex gap-2 mt-1">
                  <span class="font-mono text-[10px] text-[#4ade80]"
                    >↓ {{ formatBytes(disk.read_speed) }}/s</span
                  >
                  <span class="font-mono text-[10px] text-[#fb7185]"
                    >↑ {{ formatBytes(disk.write_speed) }}/s</span
                  >
                </div>
              </button>
            </div>

            <!-- I/O Chart Card -->
            <Card v-if="selectedDisk">
              <CardHeader>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <CardTitle
                      class="text-sm font-medium text-muted-foreground"
                    >
                      Disk I/O · {{ selectedDisk }}
                    </CardTitle>
                    <div class="flex items-center gap-3 text-xs font-mono">
                      <span class="text-[#4ade80]"
                        >↓ {{ formatBytes(currentDiskRead) }}/s</span
                      >
                      <span class="text-[#fb7185]"
                        >↑ {{ formatBytes(currentDiskWrite) }}/s</span
                      >
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full bg-muted/10 rounded-md border flex items-end p-0 relative overflow-hidden group"
                >
                  <!-- Y-axis labels -->
                  <div
                    class="absolute inset-y-0 left-0 w-16 flex flex-col justify-between py-2 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none pl-2 z-10"
                  >
                    <div>{{ formatBytes(maxDiskSpeed) }}/s</div>
                    <div>{{ formatBytes(Math.round(maxDiskSpeed / 2)) }}/s</div>
                    <div>0</div>
                  </div>
                  <!-- Grid Lines -->
                  <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none z-0"
                  >
                    <div class="border-t border-border/40 opacity-50"></div>
                    <div
                      class="border-t border-border/40 border-dashed opacity-50"
                    ></div>
                    <div class="border-b border-border/40 opacity-50"></div>
                  </div>
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    class="w-full h-full"
                    style="overflow: hidden"
                  >
                    <defs>
                      <clipPath id="diskClip">
                        <rect x="0" y="0" width="100" height="40" />
                      </clipPath>
                      <linearGradient
                        id="diskReadGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stop-color="#4ade80"
                          stop-opacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stop-color="#4ade80"
                          stop-opacity="0"
                        />
                      </linearGradient>
                      <filter
                        id="diskGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur
                          stdDeviation="1.5"
                          result="coloredBlur"
                        />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <g clip-path="url(#diskClip)">
                      <path
                        :d="diskReadAreaPath"
                        fill="url(#diskReadGradient)"
                        stroke="none"
                      />
                      <path
                        :d="diskReadPath"
                        fill="none"
                        stroke="#4ade80"
                        stroke-width="1.5"
                        filter="url(#diskGlow)"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        vector-effect="non-scaling-stroke"
                      />
                      <path
                        :d="diskWritePath"
                        fill="none"
                        stroke="#fb7185"
                        stroke-width="1.5"
                        filter="url(#diskGlow)"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        vector-effect="non-scaling-stroke"
                      />
                    </g>
                  </svg>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-6xl select-none pointer-events-none group-hover:opacity-0 transition-opacity"
                  >
                    REALTIME
                  </div>
                  <div
                    class="absolute bottom-2 right-3 flex items-center gap-3 text-[10px] font-mono text-muted-foreground"
                  >
                    <span class="flex items-center gap-1">
                      <span class="inline-block w-3 h-0.5 bg-[#4ade80]"></span>
                      Read
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="inline-block w-3 h-0.5 bg-[#fb7185]"></span>
                      Write
                    </span>
                  </div>
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
            <!-- Interface Tab Bar -->
            <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <!-- All tab -->
              <button
                @click="selectedIface = 'all'"
                :class="[
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-xs whitespace-nowrap transition-all w-[120px]',
                  selectedIface === 'all'
                    ? 'border-[#38bdf8] bg-[#38bdf8]/10'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                ]"
              >
                <span
                  :class="
                    selectedIface === 'all'
                      ? 'text-[#38bdf8] font-medium'
                      : 'text-foreground'
                  "
                  >All</span
                >
                <span class="font-mono text-[10px] text-[#4ade80] mt-1"
                  >↑
                  {{
                    formatBytes(
                      (server.network?.interfaces ?? [])
                        .filter((i: any) => i.interface_name !== "lo")
                        .reduce(
                          (s: number, i: any) => s + (i.transmit_speed || 0),
                          0,
                        ),
                    )
                  }}/s</span
                >
                <span class="font-mono text-[10px] text-[#38bdf8]"
                  >↓
                  {{
                    formatBytes(
                      (server.network?.interfaces ?? [])
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
                    ? 'border-[#38bdf8] bg-[#38bdf8]/10'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                ]"
              >
                <span
                  :class="
                    selectedIface === iface.interface_name
                      ? 'text-[#38bdf8] font-medium'
                      : 'text-foreground'
                  "
                  >{{ iface.interface_name }}</span
                >
                <span class="font-mono text-[10px] text-[#4ade80] mt-1"
                  >↑ {{ formatBytes(iface.transmit_speed) }}/s</span
                >
                <span class="font-mono text-[10px] text-[#38bdf8]"
                  >↓ {{ formatBytes(iface.receive_speed) }}/s</span
                >
              </button>
            </div>

            <!-- Chart Card -->
            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <CardTitle
                      class="text-sm font-medium text-muted-foreground"
                    >
                      {{
                        selectedIface === "all"
                          ? "Network Throughput"
                          : selectedIface
                      }}
                    </CardTitle>
                    <div class="flex items-center gap-3 text-xs font-mono">
                      <span class="text-[#38bdf8]"
                        >↓ {{ formatBytes(currentNetRx) }}/s</span
                      >
                      <span class="text-[#4ade80]"
                        >↑ {{ formatBytes(currentNetTx) }}/s</span
                      >
                    </div>
                  </div>
                  <Tabs v-model="netMode" class="w-[200px]">
                    <TabsList class="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="realtime" class="text-xs"
                        >Realtime</TabsTrigger
                      >
                      <TabsTrigger value="history" class="text-xs"
                        >History</TabsTrigger
                      >
                    </TabsList>
                  </Tabs>
                </div>
                <div class="h-5 flex items-center" v-if="netMode === 'history'">
                  <span
                    class="text-xs text-muted-foreground"
                    v-if="isLoadingNetHistory"
                    >Loading history...</span
                  >
                  <span
                    class="text-xs text-muted-foreground"
                    v-else-if="netHistoryData.length > 0"
                    >Last {{ netHistoryData.length }} records</span
                  >
                </div>
              </CardHeader>
              <CardContent>
                <div
                  class="h-[260px] w-full bg-muted/10 rounded-md border flex items-end p-0 relative overflow-hidden group"
                >
                  <!-- Y-axis labels (dynamic scale) -->
                  <div
                    class="absolute inset-y-0 left-0 w-16 flex flex-col justify-between py-2 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none pl-2 z-10"
                  >
                    <div>{{ formatBytes(maxNetSpeed) }}/s</div>
                    <div>{{ formatBytes(maxNetSpeed / 2) }}/s</div>
                    <div>0</div>
                  </div>
                  <!-- Grid Lines -->
                  <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none z-0"
                  >
                    <div class="border-t border-border/40 opacity-50"></div>
                    <div
                      class="border-t border-border/40 border-dashed opacity-50"
                    ></div>
                    <div class="border-b border-border/40 opacity-50"></div>
                  </div>
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    class="w-full h-full"
                    style="overflow: hidden"
                  >
                    <defs>
                      <clipPath id="netClip">
                        <rect x="0" y="0" width="100" height="40" />
                      </clipPath>
                      <linearGradient
                        id="netRxGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stop-color="#38bdf8"
                          stop-opacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stop-color="#38bdf8"
                          stop-opacity="0"
                        />
                      </linearGradient>
                      <filter
                        id="netGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur
                          stdDeviation="1.5"
                          result="coloredBlur"
                        />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <g clip-path="url(#netClip)">
                      <path
                        :d="netRxAreaPath"
                        fill="url(#netRxGradient)"
                        stroke="none"
                      />
                      <path
                        :d="netRxPath"
                        fill="none"
                        stroke="#38bdf8"
                        stroke-width="1.5"
                        filter="url(#netGlow)"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        vector-effect="non-scaling-stroke"
                      />
                      <path
                        :d="netTxPath"
                        fill="none"
                        stroke="#4ade80"
                        stroke-width="1.5"
                        filter="url(#netGlow)"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        vector-effect="non-scaling-stroke"
                      />
                    </g>
                  </svg>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-6xl select-none pointer-events-none group-hover:opacity-0 transition-opacity"
                  >
                    {{ netMode === "realtime" ? "REALTIME" : "HISTORY" }}
                  </div>
                  <div
                    v-if="netMode === 'history' && netHistoryData.length > 0"
                    class="absolute bottom-1 left-20 text-[10px] text-muted-foreground font-mono"
                  >
                    {{ formatTimestamp(netHistoryData[0].timestamp) }}
                  </div>
                  <div
                    v-if="netMode === 'history' && netHistoryData.length > 0"
                    class="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono"
                  >
                    {{
                      formatTimestamp(
                        netHistoryData[netHistoryData.length - 1].timestamp,
                      )
                    }}
                  </div>
                </div>
                <!-- Legend -->
                <div
                  class="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground"
                >
                  <span class="flex items-center gap-1">
                    <span class="inline-block w-3 h-0.5 bg-[#38bdf8]"></span>
                    Download (↓)
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="inline-block w-3 h-0.5 bg-[#4ade80]"></span>
                    Upload (↑)
                  </span>
                  <span
                    v-if="server.network?.tcp_connections != null"
                    class="ml-auto"
                  >
                    TCP {{ server.network.tcp_connections }} &nbsp; UDP
                    {{ server.network.udp_connections }}
                  </span>
                </div>
              </CardContent>
            </Card>

            <!-- Interfaces List -->
            <Card>
              <CardHeader>
                <CardTitle>Network Interfaces</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="space-y-3">
                  <div
                    v-for="(iface, index) in sortedInterfaces"
                    :key="index"
                    @click="selectedIface = iface.interface_name"
                    :class="[
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
                      selectedIface === iface.interface_name
                        ? 'border-[#38bdf8] bg-[#38bdf8]/5'
                        : 'bg-muted/30 hover:bg-muted/50',
                    ]"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="h-8 w-8 rounded bg-background flex items-center justify-center border"
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
                    <div class="text-right text-xs font-mono space-y-1">
                      <div class="text-[#38bdf8]">
                        ↓ {{ formatBytes(iface.receive_speed) }}/s
                      </div>
                      <div class="text-[#4ade80]">
                        ↑ {{ formatBytes(iface.transmit_speed) }}/s
                      </div>
                    </div>
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
