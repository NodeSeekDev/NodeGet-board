<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAgentStatus } from "@/composables/useAgentStatus";
import { useStaticMonitoring } from "@/composables/monitoring/useStaticMonitoring";
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

const { t } = useI18n();

const route = useRoute("/server-detail/[uuid]");
const router = useRouter();
const uuid = route.params.uuid;

const isSidebarOpen = ref(false);

const {
  status: dynamicStatus,
  error: dynamicError,
  servers: dynamicServers,
  fetchDynamic,
  fetchDynamicSummary,
} = useAgentStatus();

const { servers: staticServers, refresh: connectStatic } =
  useStaticMonitoring();

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
    const res = await fetchDynamicSummary(
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
  connectStatic();
});

onUnmounted(() => {
  stopDiskTimer();
  stopNetworkTimer();
});
</script>

<template>
  <div class="flex h-screen flex-col text-foreground">
    <div class="border-b">
      <div class="container mx-auto flex items-center gap-4 px-4 py-3">
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
    <div class="relative flex flex-1 overflow-hidden">
      <!-- Mobile Sidebar Overlay -->
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <!-- Sidebar -->
      <aside
        :class="[
          'z-50 flex flex-col border-r bg-muted/20 transition-all duration-300 ease-in-out',
          'fixed inset-y-0 left-0 h-full bg-background md:relative md:bg-muted/20',
          isSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0',
          'md:w-72',
          'w-72',
        ]"
      >
        <div
          class="box-border flex h-16 items-center gap-2 overflow-hidden border-b p-4"
        >
          <Button
            @click="router.back()"
            variant="ghost"
            size="icon"
            class="h-8 w-8 shrink-0"
          >
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div class="flex-1 overflow-hidden transition-opacity duration-300">
            <div v-if="server">
              <h2 class="truncate font-semibold">{{ showHostname(server) }}</h2>
              <p class="truncate text-xs text-muted-foreground">
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
            class="ml-auto h-8 w-8 md:hidden"
            @click="isSidebarOpen = false"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex-1 overflow-x-hidden overflow-y-auto">
          <div class="space-y-1 p-2" v-if="server">
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
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  activeTab === tab.id
                    ? 'shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                ]"
              >
                <div
                  :class="[
                    'shrink-0 rounded-md p-2 transition-all',
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
                <div class="min-w-0 flex-1 transition-all duration-300">
                  <div
                    class="truncate text-sm font-medium"
                    :style="
                      activeTab === tab.id
                        ? { color: getcolors(tab.id).color }
                        : {}
                    "
                  >
                    {{ tab.label.value }}
                  </div>
                  <div
                    class="mt-0.5 truncate font-mono text-xs text-muted-foreground"
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
                  class="h-8 w-1 shrink-0 overflow-hidden rounded-full bg-muted/20 transition-all duration-300"
                  v-if="['cpu', 'memory', 'disk'].includes(tab.id)"
                >
                  <div
                    class="w-full rounded-full transition-all duration-500"
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
      <main class="flex min-w-0 flex-1 flex-col">
        <div
          v-if="!server"
          class="flex flex-1 items-center justify-center text-muted-foreground"
        >
          <div class="flex flex-col items-center gap-2">
            <div
              v-if="dynamicError"
              class="flex items-center gap-2 text-destructive"
            >
              <AlertCircle class="h-5 w-5" /> {{ dynamicError }}
            </div>
            <span v-else>{{ $t("serverDetail.connecting") }}</span>
          </div>
        </div>

        <div
          v-else
          class="flex-1 overflow-y-auto p-6"
          :style="{ '--primary': `hsl(${activeTheme.hsl})` }"
        >
          <div class="mx-auto max-w-5xl space-y-6">
            <div class="flex items-center justify-between">
              <h1 class="tracking-light text-3xl font-bold">
                {{ tabs.find((t) => t.id === activeTab)?.label.value }}
              </h1>
              <Badge variant="outline" class="font-mono text-xs">
                <Clock class="mr-1 h-3 w-3" />
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
                        <TabsList class="grid h-8 w-full grid-cols-2">
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
                    <div class="flex h-9 items-end" v-else>
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
                      class="group relative flex h-[200px] w-full items-end overflow-hidden rounded-md border bg-muted/10 p-0"
                    >
                      <!-- Axis Guide -->
                      <div
                        class="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-8 flex-col justify-between py-2 pl-2 font-mono text-[10px] text-muted-foreground/60 select-none"
                      >
                        <div>100%</div>
                        <div>50%</div>
                        <div>0%</div>
                      </div>
                      <!-- Grid Lines -->
                      <div
                        class="pointer-events-none absolute inset-0 z-0 flex flex-col justify-between"
                      >
                        <div class="border-t border-border/40 opacity-50"></div>
                        <div
                          class="border-t border-dashed border-border/40 opacity-50"
                        ></div>
                        <div class="border-b border-border/40 opacity-50"></div>
                      </div>
                      <svg
                        viewBox="0 0 100 40"
                        preserveAspectRatio="none"
                        class="h-full w-full text-primary"
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
                        class="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-bold text-muted-foreground/20 transition-opacity select-none group-hover:opacity-0"
                      >
                        {{
                          cpuMode === "realtime"
                            ? $t("serverDetail.realtime")
                            : $t("serverDetail.history")
                        }}
                      </div>
                      <div
                        v-if="cpuMode === 'history' && historyData.length > 0"
                        class="absolute bottom-1 left-12 font-mono text-[10px] text-muted-foreground"
                      >
                        {{ formatTimestamp(historyData[0]!.timestamp) }}
                      </div>
                      <div
                        v-if="cpuMode === 'history' && historyData.length > 0"
                        class="absolute right-2 bottom-1 font-mono text-[10px] text-muted-foreground"
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

                <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div
                    class="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <div class="mb-1 text-xs text-muted-foreground">
                      {{ $t("serverDetail.cpu.loadAverage") }}
                    </div>
                    <div class="font-mono text-lg">
                      {{ formatLoad(server) }}
                    </div>
                  </div>
                  <div
                    class="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <div class="mb-1 text-xs text-muted-foreground">
                      {{ $t("serverDetail.cpu.cores") }}
                    </div>
                    <div class="font-mono text-lg">
                      {{ server.cpu_static?.per_core?.length ?? "-" }}
                    </div>
                  </div>
                  <div
                    class="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <div class="mb-1 text-xs text-muted-foreground">
                      {{ $t("serverDetail.cpu.model") }}
                    </div>
                    <div
                      class="truncate text-sm font-medium"
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
                <div class="grid gap-8 md:grid-cols-2">
                  <!-- Memory Card -->
                  <div
                    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all hover:shadow-[0_12px_40px_rgba(74,222,128,0.1)] dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  >
                    <!-- Subtle glow effect -->
                    <div
                      class="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-[0.07]"
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
                          class="-rotate-90 transform"
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
                      <div class="min-w-0 flex-1 space-y-3">
                        <div class="flex items-center gap-2">
                          <Database class="h-4 w-4 text-muted-foreground" />
                          <span class="text-lg font-semibold">Memory</span>
                        </div>
                        <div class="font-mono text-xs text-muted-foreground">
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
                    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-[0.05]"
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
                          class="-rotate-90 transform"
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
                      <div class="min-w-0 flex-1 space-y-3">
                        <div class="flex items-center gap-2">
                          <CircuitBoard class="h-4 w-4 text-muted-foreground" />
                          <span class="text-lg font-semibold">Swap</span>
                        </div>
                        <div class="font-mono text-xs text-muted-foreground">
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
                  class="py-12 text-center text-sm text-muted-foreground"
                >
                  {{ $t("common.loading") }}
                </div>
                <div v-else class="grid gap-8 md:grid-cols-2">
                  <div
                    v-for="(disk, index) in diskList"
                    :key="index"
                    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all hover:shadow-[0_12px_40px_rgba(251,146,60,0.1)] dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-[0.07]"
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
                          class="-rotate-90 transform"
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
                      <div class="min-w-0 flex-1 space-y-3">
                        <div class="flex items-center gap-2">
                          <HardDrive
                            class="h-4 w-4"
                            :style="{ color: activeTheme.color }"
                          />
                          <span class="truncate text-lg font-semibold">{{
                            disk.mount_point
                          }}</span>
                        </div>
                        <div
                          class="truncate font-mono text-xs text-muted-foreground"
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
                    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 px-8 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-[0.07]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-4">
                      <div
                        class="flex h-10 w-10 items-center justify-center rounded-xl"
                        :style="{ backgroundColor: `${activeTheme.color}15` }"
                      >
                        <ArrowDownToLine
                          class="h-5 w-5"
                          :style="{ color: activeTheme.color }"
                        />
                      </div>
                      <div>
                        <div
                          class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                        >
                          Download
                        </div>
                        <div
                          class="font-mono text-2xl font-bold tracking-tight"
                          :style="{ color: activeTheme.color }"
                        >
                          {{ showNetworkSpeed(server, "rx") }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 px-8 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  >
                    <div
                      class="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-[0.05]"
                      :style="{
                        background: `radial-gradient(circle, ${activeTheme.color}, transparent)`,
                      }"
                    ></div>
                    <div class="relative flex items-center gap-4">
                      <div
                        class="flex h-10 w-10 items-center justify-center rounded-xl"
                        :style="{ backgroundColor: `${activeTheme.color}15` }"
                      >
                        <ArrowUpFromLine
                          class="h-5 w-5"
                          :style="{ color: activeTheme.color, opacity: 0.7 }"
                        />
                      </div>
                      <div>
                        <div
                          class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                        >
                          Upload
                        </div>
                        <div
                          class="font-mono text-2xl font-bold tracking-tight"
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
                  class="py-8 text-center text-sm text-muted-foreground"
                >
                  {{ $t("common.loading") }}
                </div>
                <div
                  v-else
                  class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  <div
                    v-for="(iface, index) in networkInterfaces"
                    :key="index"
                    class="relative space-y-3 rounded-xl border border-white/10 bg-gradient-to-br from-card/60 to-card/30 p-4 backdrop-blur-lg transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:border-white/[0.06]"
                  >
                    <div class="flex items-center gap-2.5">
                      <div
                        class="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/40"
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
                        <div class="truncate text-sm font-semibold">
                          {{ iface.interface_name }}
                        </div>
                        <div
                          v-if="iface.ip_address"
                          class="truncate font-mono text-[10px] text-muted-foreground"
                        >
                          {{ iface.ip_address }}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 font-mono text-xs">
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
