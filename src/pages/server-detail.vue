<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
import { useBackendStore } from "@/composables/useBackendStore";
import { colors } from "@/composables/color";
import { formatLoad, formatBytes, formatUptime } from "@/utils/format";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import HeaderView from "@/components/HeaderView.vue";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Cpu,
  Database,
  HardDrive,
  Network,
  AlertCircle,
  Menu,
  X,
  Clock,
} from "lucide-vue-next";
import { usePermissionStore } from "@/stores/permission";

definePage({
  path: "/s/:uuid",
});

const { hasPermission } = usePermissionStore();
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
} = useDynamicData();

const { servers: staticServers, connect: connectStatic } = useStaticData();

const activeTab = ref("cpu");

const server = computed(() => {
  const dServer = dynamicServers.value.find((s) => s.uuid === uuid);
  const sServer = staticServers.value.find((s) => s.uuid === uuid);

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

onMounted(() => {
  connectDynamic();
  connectStatic();
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
                {{ $t("common.uptime") }}:
                {{ formatUptime(server.uptime ?? 0) }}
              </Badge>
            </div>

            <!-- CPU View -->
            <Transition name="fade" mode="out-in">
              <div v-if="activeTab === 'cpu'" key="cpu" class="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{{
                      $t("serverDetail.cpu.totalUtilization")
                    }}</CardTitle>
                    <div class="text-4xl font-bold tracking-tighter">
                      {{ showCpuPercent(server).toFixed(1) }}%
                    </div>
                  </CardHeader>
                </Card>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div class="text-xs text-muted-foreground mb-1">
                      {{ $t("serverDetail.cpu.loadAverage") }}
                    </div>
                    <div class="text-lg font-mono">
                      {{
                        formatLoad({
                          load_one: server.load_one,
                          load_five: server.load_five,
                          load_fifteen: server.load_fifteen,
                        })
                      }}
                    </div>
                  </div>
                  <div
                    class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div class="text-xs text-muted-foreground mb-1">
                      {{ $t("serverDetail.cpu.processes") }}
                    </div>
                    <div class="text-lg font-mono">
                      {{ server.process_count ?? "-" }}
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
                <div class="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{{
                        $t("serverDetail.memory.usage")
                      }}</CardTitle>
                      <div class="text-3xl font-bold">
                        {{ showRamPercent(server).toFixed(1) }}%
                      </div>
                      <CardDescription class="font-mono">{{
                        showRamText(server)
                      }}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        :model-value="showRamPercent(server)"
                        class="h-4"
                      />
                      <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                          <span class="text-muted-foreground">{{
                            $t("serverDetail.memory.used")
                          }}</span>
                          <span class="font-mono">{{
                            formatBytes(server.used_memory ?? 0)
                          }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="text-muted-foreground">{{
                            $t("serverDetail.memory.available")
                          }}</span>
                          <span class="font-mono">{{
                            formatBytes(server.available_memory ?? 0)
                          }}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{{
                        $t("serverDetail.memory.swapUsage")
                      }}</CardTitle>
                      <div class="text-3xl font-bold">
                        {{
                          server.total_swap
                            ? (
                                ((server.used_swap ?? 0) / server.total_swap) *
                                100
                              ).toFixed(1)
                            : 0
                        }}%
                      </div>
                      <CardDescription class="font-mono">
                        {{ formatBytes(server.used_swap || 0) }} /
                        {{ formatBytes(server.total_swap || 0) }}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        :model-value="
                          server.total_swap
                            ? ((server.used_swap ?? 0) / server.total_swap) *
                              100
                            : 0
                        "
                        class="h-4"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              <!-- Disk View -->
              <div
                v-else-if="activeTab === 'disk'"
                key="disk"
                class="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <div class="flex items-center justify-between">
                      <CardTitle class="flex items-center gap-2">
                        <HardDrive class="h-4 w-4" />
                        {{ $t("common.disk") }}
                      </CardTitle>
                      <div class="flex items-center gap-3 text-xs font-mono">
                        <span class="text-emerald-500"
                          >↓ {{ formatBytes(server.read_speed ?? 0) }}/s</span
                        >
                        <span class="text-blue-500"
                          >↑ {{ formatBytes(server.write_speed ?? 0) }}/s</span
                        >
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent v-if="server.total_space">
                    <div class="flex items-end justify-between mb-2">
                      <div class="text-2xl font-bold">
                        {{
                          (
                            (1 -
                              (server.available_space ?? 0) /
                                server.total_space) *
                            100
                          ).toFixed(0)
                        }}%
                      </div>
                      <div class="text-sm text-muted-foreground font-mono">
                        {{
                          formatBytes(
                            server.total_space - (server.available_space ?? 0),
                          )
                        }}
                        {{ $t("serverDetail.disk.usedOf") }}
                        {{ formatBytes(server.total_space) }}
                      </div>
                    </div>
                    <Progress
                      :model-value="
                        (1 -
                          (server.available_space ?? 0) / server.total_space) *
                        100
                      "
                      class="h-3"
                    />
                  </CardContent>
                </Card>
              </div>

              <!-- Network View -->
              <div
                v-else-if="activeTab === 'network'"
                key="network"
                class="space-y-6"
              >
                <div class="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent class="pt-2">
                      <div
                        class="text-sm font-medium text-muted-foreground mb-2"
                      >
                        {{ $t("serverDetail.network.totalDownload") }}
                      </div>
                      <div class="text-3xl font-bold font-mono">
                        {{ showNetworkSpeed(server, "rx") }}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent class="pt-2">
                      <div
                        class="text-sm font-medium text-muted-foreground mb-2"
                      >
                        {{ $t("serverDetail.network.totalUpload") }}
                      </div>
                      <div class="text-3xl font-bold font-mono">
                        {{ showNetworkSpeed(server, "tx") }}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div
                  class="grid md:grid-cols-2 gap-6"
                  v-if="server.total_received != null"
                >
                  <Card>
                    <CardContent class="pt-2">
                      <div
                        class="text-sm font-medium text-muted-foreground mb-2"
                      >
                        {{ $t("serverDetail.network.totalReceived") }}
                      </div>
                      <div class="text-2xl font-bold font-mono">
                        {{ formatBytes(server.total_received ?? 0) }}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent class="pt-2">
                      <div
                        class="text-sm font-medium text-muted-foreground mb-2"
                      >
                        {{ $t("serverDetail.network.totalTransmitted") }}
                      </div>
                      <div class="text-2xl font-bold font-mono">
                        {{ formatBytes(server.total_transmitted ?? 0) }}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
