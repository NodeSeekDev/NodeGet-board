<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
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
  showHostname,
  showOS,
  showCpuPercent,
  showRamPercent,
  showRamText,
  showNetworkSpeed,
  showDiskPercent,
  showDiskDisplay,
} from "@/utils/show";

import { useRoute, useRouter } from "vue-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HeaderView from "@/components/HeaderView.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  Database,
  HardDrive,
  CircuitBoard,
  Network,
  Wifi,
  AlertCircle,
  Menu,
  X,
  Clock,
  Container,
  Fish,
} from "lucide-vue-next";
import type {
  DynamicDetailData,
  DynamicDisk,
  DynamicNetworkInterface,
} from "@/types/monitoring";

definePage({
  path: "/s/:uuid",
});

const { t } = useI18n();

const route = useRoute();
const router = useRouter();
const uuid = (route.params as { uuid: string }).uuid;

const isSidebarOpen = ref(false);

const {
  status: dynamicStatus,
  error: dynamicError,
  servers: dynamicServers,
  connect: connectDynamic,
  fetchDynamic,
  fetchSummaryAvg,
} = useDynamicData();

const { servers: staticServers, connect: connectStatic } = useStaticData();

const activeTab = ref("cpu");

const server = computed(() => {
  const dServer = dynamicServers.value.find((s) => s.uuid === uuid);
  const sServer = staticServers.value.find((s) => s.uuid === uuid);

  if (!dServer) return undefined;

  return {
    ...dServer,
    cpu_static: sServer?.cpu,
    system: sServer?.system,
    gpu: sServer?.gpu || [],
  };
});

const getcolors = (id: string) => {
  return (colors as any)[id] || colors.cpu;
};

const tabs = [
  { id: "cpu", label: computed(() => t("serverDetail.tabs.cpu")), icon: Cpu },
  {
    id: "memory",
    label: computed(() => t("serverDetail.tabs.memory")),
    icon: Database,
  },
  {
    id: "disk",
    label: computed(() => t("serverDetail.tabs.disk")),
    icon: HardDrive,
  },
  {
    id: "network",
    label: computed(() => t("serverDetail.tabs.network")),
    icon: Network,
  },
];

const activeTheme = computed(() => getcolors(activeTab.value));

const cpuHistory = ref<number[]>([]);
const cpuMode = ref("realtime");
const historyData = ref<{ timestamp: number; cpu_usage: number }[]>([]);
const isLoadingHistory = ref(false);

watch(server, (newServer: any) => {
  if (newServer) {
    const cpuPercent = showCpuPercent(newServer);
    cpuHistory.value.push(cpuPercent);
    if (cpuHistory.value.length > 30) {
      cpuHistory.value.shift();
    }
  }
});

const loadHistory = async () => {
  if (!uuid) return;
  isLoadingHistory.value = true;
  try {
    const now = Date.now();
    const from = now - 10 * 60 * 1000;
    const res = await fetchSummaryAvg(
      uuid,
      { timestamp_from: from, timestamp_to: now },
      ["cpu_usage"],
    );
    if (Array.isArray(res)) {
      historyData.value = res
        .map((r: any) => ({
          timestamp: r.timestamp ?? r.time ?? 0,
          cpu_usage: r.cpu_usage ?? 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
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

const displayData = computed(() => {
  if (cpuMode.value === "history") {
    return historyData.value.map((item) => item.cpu_usage);
  }
  return cpuHistory.value;
});

const historyPath = computed(() => {
  const data = displayData.value;
  if (data.length < 2) return "";

  const width = 100;
  const height = 40;
  const maxVal = 100;

  const points: [number, number][] = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (val / maxVal) * height;
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

// Per-disk array (flat summary API doesn't expose it; fetch via dynamic detail)
type NetworkInterfaceWithIp = DynamicNetworkInterface & { ip_address?: string };
const diskList = ref<DynamicDisk[]>([]);
const networkInterfaces = ref<NetworkInterfaceWithIp[]>([]);
let diskTimer: ReturnType<typeof setInterval> | null = null;
let networkTimer: ReturnType<typeof setInterval> | null = null;

const fetchDiskDetail = async () => {
  if (!uuid) return;
  try {
    const result: DynamicDetailData[] = await fetchDynamic(uuid, ["disk"]);
    const last = result[result.length - 1];
    diskList.value = last?.disk ?? [];
  } catch (e) {
    console.error("[ServerDetail] Failed to fetch disk detail", e);
  }
};

const fetchNetworkDetail = async () => {
  if (!uuid) return;
  try {
    const result: DynamicDetailData[] = await fetchDynamic(uuid, ["network"]);
    const last = result[result.length - 1];
    networkInterfaces.value = last?.network?.interfaces ?? [];
  } catch (e) {
    console.error("[ServerDetail] Failed to fetch network detail", e);
  }
};

const stopDiskTimer = () => {
  if (diskTimer) {
    clearInterval(diskTimer);
    diskTimer = null;
  }
};

const stopNetworkTimer = () => {
  if (networkTimer) {
    clearInterval(networkTimer);
    networkTimer = null;
  }
};

watch(activeTab, (tab) => {
  stopDiskTimer();
  stopNetworkTimer();
  if (tab === "disk") {
    fetchDiskDetail();
    diskTimer = setInterval(fetchDiskDetail, 3000);
  } else if (tab === "network") {
    fetchNetworkDetail();
    networkTimer = setInterval(fetchNetworkDetail, 3000);
  }
});

onMounted(() => {
  connectDynamic();
  connectStatic();
});

onUnmounted(() => {
  stopDiskTimer();
  stopNetworkTimer();
});
</script>

<template>
  <div class="flex flex-col h-screen text-foreground">
    <div class="border-b">
      <div class="container mx-auto py-3 px-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          class="md:hidden"
          @click="isSidebarOpen = true"
        >
          <Menu class="h-5 w-5" />
        </Button>

        <div class="flex-1">
          <HeaderView :status="dynamicStatus" />
        </div>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Mobile Sidebar Overlay -->
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <!-- Sidebar -->
      <aside
        :class="[
          'border-r bg-muted/20 flex flex-col transition-all duration-300 ease-in-out z-50',
          'fixed inset-y-0 left-0 h-full bg-background md:bg-muted/20 md:relative',
          isSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0',
          'md:w-72',
          'w-72',
        ]"
      >
        <div
          class="p-4 border-b flex items-center gap-2 h-16 box-border overflow-hidden"
        >
          <Button
            @click="router.back()"
            variant="ghost"
            size="icon"
            class="h-8 w-8 shrink-0"
          >
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div class="overflow-hidden flex-1 transition-opacity duration-300">
            <div v-if="server">
              <h2 class="font-semibold truncate">{{ showHostname(server) }}</h2>
              <p class="text-xs text-muted-foreground truncate">
                {{ showOS(server) }}
              </p>
            </div>
            <div v-else class="text-sm font-medium">
              {{ $t("common.loading") }}
            </div>
          </div>

          <!-- Mobile Close Button -->
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 md:hidden ml-auto"
            @click="isSidebarOpen = false"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <div class="p-2 space-y-1" v-if="server">
            <template v-for="tab in tabs" :key="tab.id">
              <button
                @click="
                  () => {
                    activeTab = tab.id;
                    isSidebarOpen = false;
                  }
                "
                :title="tab.label.value"
                :style="
                  activeTab === tab.id
                    ? {
                        backgroundColor: `${getcolors(tab.id).color}20`,
                        borderColor: getcolors(tab.id).color,
                      }
                    : {}
                "
                :class="[
                  'w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border',
                  activeTab === tab.id
                    ? 'shadow-sm'
                    : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                ]"
              >
                <div
                  :class="[
                    'p-2 rounded-md shrink-0 transition-all',
                    activeTab === tab.id ? '' : 'bg-muted',
                  ]"
                  :style="
                    activeTab === tab.id
                      ? { backgroundColor: `${getcolors(tab.id).color}20` }
                      : {}
                  "
                >
                  <component
                    :is="tab.icon"
                    :class="[
                      'h-5 w-5',
                      activeTab === tab.id ? '' : 'text-muted-foreground',
                    ]"
                    :style="
                      activeTab === tab.id
                        ? { color: getcolors(tab.id).color }
                        : {}
                    "
                  />
                </div>
                <div class="flex-1 min-w-0 transition-all duration-300">
                  <div
                    class="font-medium text-sm truncate"
                    :style="
                      activeTab === tab.id
                        ? { color: getcolors(tab.id).color }
                        : {}
                    "
                  >
                    {{ tab.label.value }}
                  </div>
                  <div
                    class="text-xs text-muted-foreground mt-0.5 font-mono truncate"
                  >
                    <span v-if="tab.id === 'cpu'"
                      >{{ showCpuPercent(server).toFixed(1) }}%</span
                    >
                    <span v-else-if="tab.id === 'memory'"
                      >{{ showRamPercent(server).toFixed(1) }}%</span
                    >
                    <span v-else-if="tab.id === 'disk'">{{
                      showDiskDisplay(server)
                    }}</span>
                    <span v-else-if="tab.id === 'network'">{{
                      showNetworkSpeed(server, "total")
                    }}</span>
                  </div>
                </div>
                <div
                  class="w-1 h-8 rounded-full bg-muted/20 overflow-hidden shrink-0 transition-all duration-300"
                  v-if="['cpu', 'memory', 'disk'].includes(tab.id)"
                >
                  <div
                    class="w-full transition-all duration-500 rounded-full"
                    :style="{
                      backgroundColor: getcolors(tab.id).color,
                      height:
                        (tab.id === 'cpu'
                          ? showCpuPercent(server)
                          : tab.id === 'memory'
                            ? showRamPercent(server)
                            : tab.id === 'disk'
                              ? showDiskPercent(server)
                              : 0) + '%',
                    }"
                  ></div>
                </div>
              </button>
            </template>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0">
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
            <span v-else>{{ $t("serverDetail.connecting") }}</span>
          </div>
        </div>

        <div
          v-else
          class="flex-1 p-6 overflow-y-auto"
          :style="{ '--primary': `hsl(${activeTheme.hsl})` }"
        >
          <div class="max-w-5xl mx-auto space-y-6">
            <div class="flex items-center justify-between">
              <h1 class="text-3xl font-bold tracking-light">
                {{ tabs.find((t) => t.id === activeTab)?.label.value }}
              </h1>
              <Badge variant="outline" class="font-mono text-xs">
                <Clock class="h-3 w-3 mr-1" />
                System Uptime:
                {{ formatUptime(server.uptime ?? 0) }}
              </Badge>
            </div>

            <!-- CPU View -->
            <Transition name="fade" mode="out-in">
              <div v-if="activeTab === 'cpu'" key="cpu" class="space-y-6">
                <Card>
                  <CardHeader>
                    <div class="flex items-center justify-between">
                      <CardTitle>{{
                        $t("serverDetail.cpu.totalUtilization")
                      }}</CardTitle>
                      <Tabs v-model="cpuMode" class="w-[200px]">
                        <TabsList class="grid w-full grid-cols-2 h-8">
                          <TabsTrigger value="realtime" class="text-xs">{{
                            $t("serverDetail.cpu.realtime")
                          }}</TabsTrigger>
                          <TabsTrigger value="history" class="text-xs">{{
                            $t("serverDetail.cpu.history")
                          }}</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div
                      class="text-4xl font-bold tracking-tighter"
                      v-if="cpuMode === 'realtime'"
                    >
                      {{ showCpuPercent(server).toFixed(1) }}%
                    </div>
                    <div class="h-9 flex items-end" v-else>
                      <span v-if="isLoadingHistory">{{
                        $t("serverDetail.cpu.loadingHistory")
                      }}</span>
                      <span
                        class="text-sm text-muted-foreground"
                        v-else-if="historyData.length > 0"
                      >
                        {{
                          $t("serverDetail.cpu.lastRecords", [
                            historyData.length,
                          ])
                        }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      class="h-[200px] w-full bg-muted/10 rounded-md border flex items-end p-0 relative overflow-hidden group"
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
                            <feGaussianBlur
                              stdDeviation="2"
                              result="coloredBlur"
                            />
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
                        {{
                          cpuMode === "realtime"
                            ? $t("serverDetail.realtime")
                            : $t("serverDetail.history")
                        }}
                      </div>
                      <div
                        v-if="cpuMode === 'history' && historyData.length > 0"
                        class="absolute bottom-1 left-12 text-[10px] text-muted-foreground font-mono"
                      >
                        {{ formatTimestamp(historyData[0]!.timestamp) }}
                      </div>
                      <div
                        v-if="cpuMode === 'history' && historyData.length > 0"
                        class="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono"
                      >
                        {{
                          formatTimestamp(
                            historyData[historyData.length - 1]!.timestamp,
                          )
                        }}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div class="text-xs text-muted-foreground mb-1">
                      {{ $t("serverDetail.cpu.loadAverage") }}
                    </div>
                    <div class="text-lg font-mono">
                      {{ formatLoad(server) }}
                    </div>
                  </div>
                  <div
                    class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div class="text-xs text-muted-foreground mb-1">
                      {{ $t("serverDetail.cpu.cores") }}
                    </div>
                    <div class="text-lg font-mono">
                      {{ server.cpu_static?.per_core?.length ?? "-" }}
                    </div>
                  </div>
                  <div
                    class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div class="text-xs text-muted-foreground mb-1">
                      {{ $t("serverDetail.cpu.model") }}
                    </div>
                    <div
                      class="text-sm font-medium truncate"
                      :title="
                        server?.cpu_static?.per_core?.[0]?.brand || 'Unknown'
                      "
                    >
                      {{
                        server?.cpu_static?.per_core?.[0]?.brand || "Unknown"
                      }}
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
                <!-- Glassmorphism Cards Row -->
                <div class="grid md:grid-cols-2 gap-8">
                  <!-- Memory Card -->
                  <div
                    class="relative rounded-2xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-8 py-7 overflow-hidden transition-all hover:shadow-[0_12px_40px_rgba(74,222,128,0.1)]"
                  >
                    <!-- Subtle glow effect -->
                    <div
                      class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.07]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-8">
                      <!-- Radial Progress Ring -->
                      <div class="relative shrink-0">
                        <svg
                          width="130"
                          height="130"
                          viewBox="0 0 130 130"
                          class="transform -rotate-90"
                        >
                          <!-- Background ring -->
                          <circle
                            cx="65"
                            cy="65"
                            r="54"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="9"
                            class="text-muted/30"
                          />
                          <!-- Progress ring -->
                          <circle
                            cx="65"
                            cy="65"
                            r="54"
                            fill="none"
                            :stroke="activeTheme.color"
                            stroke-width="9"
                            stroke-linecap="round"
                            :stroke-dasharray="339.29"
                            :stroke-dashoffset="
                              339.29 - (339.29 * showRamPercent(server)) / 100
                            "
                            class="transition-all duration-700 ease-out"
                            :style="{
                              filter: `drop-shadow(0 0 6px ${activeTheme.color}40)`,
                            }"
                          />
                        </svg>
                        <!-- Center text -->
                        <div
                          class="absolute inset-0 flex flex-col items-center justify-center"
                        >
                          <span
                            class="text-2xl font-bold tracking-tight"
                            :style="{ color: activeTheme.color }"
                            >{{ showRamPercent(server).toFixed(1) }}%</span
                          >
                        </div>
                      </div>
                      <!-- Details -->
                      <div class="flex-1 min-w-0 space-y-3">
                        <div class="flex items-center gap-2">
                          <Database class="h-4 w-4 text-muted-foreground" />
                          <span class="text-lg font-semibold">Memory</span>
                        </div>
                        <div class="text-xs text-muted-foreground font-mono">
                          {{ showRamText(server) }}
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">{{
                              $t("serverDetail.memory.used")
                            }}</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(server.used_memory ?? 0)
                            }}</span>
                          </div>
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">{{
                              $t("serverDetail.memory.available")
                            }}</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(
                                server.available_memory ??
                                  (server.total_memory ?? 0) -
                                    (server.used_memory ?? 0),
                              )
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Swap Card -->
                  <div
                    class="relative rounded-2xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-8 py-7 overflow-hidden transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.05]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-8">
                      <!-- Swap Ring -->
                      <div class="relative shrink-0">
                        <svg
                          width="130"
                          height="130"
                          viewBox="0 0 130 130"
                          class="transform -rotate-90"
                        >
                          <!-- Inactive: dashed ring / Active: solid ring -->
                          <circle
                            v-if="!server.total_swap"
                            cx="65"
                            cy="65"
                            r="54"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="9"
                            stroke-dasharray="8 8"
                            class="text-muted/20"
                          />
                          <template v-else>
                            <circle
                              cx="65"
                              cy="65"
                              r="54"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="9"
                              class="text-muted/30"
                            />
                            <circle
                              cx="65"
                              cy="65"
                              r="54"
                              fill="none"
                              :stroke="activeTheme.color"
                              stroke-width="9"
                              stroke-linecap="round"
                              :stroke-dasharray="339.29"
                              :stroke-dashoffset="
                                339.29 -
                                339.29 *
                                  ((server.used_swap ?? 0) / server.total_swap)
                              "
                              class="transition-all duration-700 ease-out"
                              :style="{
                                filter: `drop-shadow(0 0 6px ${activeTheme.color}40)`,
                              }"
                            />
                          </template>
                        </svg>
                        <!-- Center text -->
                        <div
                          class="absolute inset-0 flex flex-col items-center justify-center"
                        >
                          <template v-if="!server.total_swap">
                            <span
                              class="text-sm font-medium text-muted-foreground/60"
                              >Inactive</span
                            >
                          </template>
                          <template v-else>
                            <span
                              class="text-2xl font-bold tracking-tight"
                              :style="{ color: activeTheme.color }"
                              >{{
                                (
                                  ((server.used_swap ?? 0) /
                                    server.total_swap) *
                                  100
                                ).toFixed(1)
                              }}%</span
                            >
                          </template>
                        </div>
                      </div>
                      <!-- Details -->
                      <div class="flex-1 min-w-0 space-y-3">
                        <div class="flex items-center gap-2">
                          <CircuitBoard class="h-4 w-4 text-muted-foreground" />
                          <span class="text-lg font-semibold">Swap</span>
                        </div>
                        <div class="text-xs text-muted-foreground font-mono">
                          {{ formatBytes(server.used_swap ?? 0) }} /
                          {{ formatBytes(server.total_swap ?? 0) }}
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">{{
                              $t("serverDetail.memory.used")
                            }}</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(server.used_swap ?? 0)
                            }}</span>
                          </div>
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">{{
                              $t("serverDetail.memory.available")
                            }}</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(
                                (server.total_swap ?? 0) -
                                  (server.used_swap ?? 0),
                              )
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Disk View -->
              <div
                v-else-if="activeTab === 'disk'"
                key="disk"
                class="space-y-6"
              >
                <div
                  v-if="diskList.length === 0"
                  class="text-sm text-muted-foreground text-center py-12"
                >
                  {{ $t("common.loading") }}
                </div>
                <div v-else class="grid md:grid-cols-2 gap-8">
                  <div
                    v-for="(disk, index) in diskList"
                    :key="index"
                    class="relative rounded-2xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-8 py-7 overflow-hidden transition-all hover:shadow-[0_12px_40px_rgba(251,146,60,0.1)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.07]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-8">
                      <!-- Radial Progress Ring -->
                      <div class="relative shrink-0">
                        <svg
                          width="130"
                          height="130"
                          viewBox="0 0 130 130"
                          class="transform -rotate-90"
                        >
                          <circle
                            cx="65"
                            cy="65"
                            r="54"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="9"
                            class="text-muted/30"
                          />
                          <circle
                            cx="65"
                            cy="65"
                            r="54"
                            fill="none"
                            :stroke="activeTheme.color"
                            stroke-width="9"
                            stroke-linecap="round"
                            :stroke-dasharray="339.29"
                            :stroke-dashoffset="
                              339.29 -
                              339.29 *
                                (disk.total_space
                                  ? 1 - disk.available_space / disk.total_space
                                  : 0)
                            "
                            class="transition-all duration-700 ease-out"
                            :style="{
                              filter: `drop-shadow(0 0 6px ${activeTheme.color}40)`,
                            }"
                          />
                        </svg>
                        <div
                          class="absolute inset-0 flex flex-col items-center justify-center"
                        >
                          <span
                            class="text-2xl font-bold tracking-tight"
                            :style="{ color: activeTheme.color }"
                            >{{
                              disk.total_space
                                ? (
                                    (1 -
                                      disk.available_space / disk.total_space) *
                                    100
                                  ).toFixed(0)
                                : 0
                            }}%</span
                          >
                        </div>
                      </div>
                      <!-- Details -->
                      <div class="flex-1 min-w-0 space-y-3">
                        <div class="flex items-center gap-2">
                          <HardDrive
                            class="h-4 w-4"
                            :style="{ color: activeTheme.color }"
                          />
                          <span class="text-lg font-semibold truncate">{{
                            disk.mount_point
                          }}</span>
                        </div>
                        <div
                          class="text-xs text-muted-foreground font-mono truncate"
                        >
                          {{ disk.name || $t("common.disk") + " " + index }}
                          · {{ disk.kind }}
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">Used</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(
                                disk.total_space - disk.available_space,
                              )
                            }}</span>
                          </div>
                          <div class="flex justify-between text-sm">
                            <span class="text-muted-foreground">Total</span>
                            <span class="font-mono font-medium">{{
                              formatBytes(disk.total_space)
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Network View -->
              <div
                v-else-if="activeTab === 'network'"
                key="network"
                class="space-y-6"
              >
                <!-- Total Speed Summary -->
                <div class="grid grid-cols-2 gap-8">
                  <div
                    class="relative rounded-2xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-8 py-6 overflow-hidden"
                  >
                    <div
                      class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.07]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-4">
                      <div
                        class="h-10 w-10 rounded-xl flex items-center justify-center"
                        :style="{ backgroundColor: `${activeTheme.color}15` }"
                      >
                        <ArrowDownToLine
                          class="h-5 w-5"
                          :style="{ color: activeTheme.color }"
                        />
                      </div>
                      <div>
                        <div
                          class="text-xs text-muted-foreground font-medium tracking-wide uppercase"
                        >
                          Download
                        </div>
                        <div
                          class="text-2xl font-bold font-mono tracking-tight"
                          :style="{ color: activeTheme.color }"
                        >
                          {{ showNetworkSpeed(server, "rx") }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    class="relative rounded-2xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-8 py-6 overflow-hidden"
                  >
                    <div
                      class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.05]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-4">
                      <div
                        class="h-10 w-10 rounded-xl flex items-center justify-center"
                        :style="{ backgroundColor: `${activeTheme.color}15` }"
                      >
                        <ArrowUpFromLine
                          class="h-5 w-5"
                          :style="{ color: activeTheme.color, opacity: 0.7 }"
                        />
                      </div>
                      <div>
                        <div
                          class="text-xs text-muted-foreground font-medium tracking-wide uppercase"
                        >
                          Upload
                        </div>
                        <div
                          class="text-2xl font-bold font-mono tracking-tight"
                          :style="{ color: activeTheme.color, opacity: 0.8 }"
                        >
                          {{ showNetworkSpeed(server, "tx") }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Interfaces Grid -->
                <div class="text-sm font-medium text-muted-foreground">
                  {{ $t("serverDetail.network.interfaces") }}
                </div>
                <div
                  v-if="networkInterfaces.length === 0"
                  class="text-sm text-muted-foreground text-center py-8"
                >
                  {{ $t("common.loading") }}
                </div>
                <div
                  v-else
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <div
                    v-for="(iface, index) in networkInterfaces"
                    :key="index"
                    class="relative rounded-xl border border-white/10 dark:border-white/[0.06] bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-lg p-4 space-y-3 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                  >
                    <div class="flex items-center gap-2.5">
                      <div
                        class="h-7 w-7 rounded-lg flex items-center justify-center bg-muted/40"
                      >
                        <Fish
                          v-if="iface.interface_name.startsWith('docker')"
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <Container
                          v-else-if="iface.interface_name.startsWith('podman')"
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <Wifi
                          v-else-if="iface.interface_name.startsWith('wl')"
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <Network
                          v-else
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
                      </div>
                      <div class="min-w-0">
                        <div class="font-semibold text-sm truncate">
                          {{ iface.interface_name }}
                        </div>
                        <div
                          v-if="iface.ip_address"
                          class="text-[10px] text-muted-foreground font-mono truncate"
                        >
                          {{ iface.ip_address }}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 text-xs font-mono">
                      <span
                        class="flex items-center gap-1"
                        :style="{ color: activeTheme.color }"
                      >
                        <ArrowDownToLine class="h-3 w-3" />
                        {{ formatBytes(iface.receive_speed) }}/s
                      </span>
                      <span
                        class="flex items-center gap-1"
                        :style="{ color: activeTheme.color, opacity: 0.7 }"
                      >
                        <ArrowUpFromLine class="h-3 w-3" />
                        {{ formatBytes(iface.transmit_speed) }}/s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
