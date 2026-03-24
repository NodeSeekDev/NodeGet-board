<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import { useOverviewData } from "@/composables/useOverviewData";
import { colors } from "@/composables/color";
import { formatLoad, formatBytes, formatUptime } from "@/utils/format";
import {
  showHostname,
  showOS,
  showCpuPercent,
  showRamPercent,
  showRamText,
  showNetworkSpeed,
  showDiskUsage,
  showDiskPercent,
  showDiskDisplay,
} from "@/utils/show";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  Activity,
  Server,
  Database,
  HardDrive,
  Network,
  Cpu,
  Clock,
  Timer,
  NetworkIcon,
} from "lucide-vue-next";
import HeaderView from "@/components/HeaderView.vue";
import FooterView from "@/components/FooterView.vue";

const { servers, loading, error, start, stop } = useOverviewData();

const status = computed(() =>
  loading.value ? "connecting" : error.value ? "disconnected" : "connected",
);

onMounted(() => start());
onUnmounted(() => stop());
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <div class="container mx-auto p-6 space-y-6 flex-1">
      <HeaderView :status="status" />

      <Alert v-if="error" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>{{ $t("common.error") }}</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div
        v-if="servers.length === 0 && !loading"
        class="text-center py-10 text-muted-foreground"
      >
        {{ $t("home.waitingData") }}
      </div>

      <TransitionGroup
        tag="div"
        name="list"
        class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <router-link
          v-for="server in servers"
          :key="server.uuid"
          :to="{ name: '/server-detail', params: { uuid: server.uuid } }"
          class="block h-full"
        >
          <Card class="hover:shadow-md transition-shadow h-full cursor-pointer">
            <CardHeader class="pb-3">
              <div class="flex items-start justify-between">
                <CardTitle
                  class="flex items-center gap-2 text-base font-medium"
                >
                  <div class="p-2 bg-primary/10 rounded-lg">
                    <Server class="h-4 w-4 text-primary" />
                  </div>
                  <div class="flex flex-col">
                    <span class="flex items-center gap-1">
                      <span
                        class="truncate leading-none"
                        :title="server.customName || showHostname(server)"
                        >{{ server.customName || showHostname(server) }}</span
                      >
                      <Badge
                        v-if="server.hidden"
                        variant="secondary"
                        class="ml-1 text-xs"
                        >隐藏</Badge
                      >
                    </span>
                    <span
                      class="text-[10px] text-muted-foreground font-normal mt-1 flex items-center gap-1"
                    >
                      <Clock class="h-3 w-3" />
                      {{ formatUptime((server.system?.uptime as number) ?? 0) }}
                    </span>
                  </div>
                </CardTitle>
                <Badge
                  variant="outline"
                  class="font-normal text-xs"
                  :title="showOS(server)"
                  >{{ showOS(server) }}</Badge
                >
              </div>
            </CardHeader>
            <CardContent class="grid gap-4 text-sm">
              <!-- CPU -->
              <div
                class="space-y-1"
                :style="{ '--primary': `hsl(${colors.cpu.hsl})` }"
              >
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground flex items-center gap-1"
                    ><Cpu
                      class="h-3 w-3"
                      :style="{ color: colors.cpu.color }"
                    />
                    {{ $t("common.cpu") }}</span
                  >
                  <span class="font-medium"
                    >{{ showCpuPercent(server).toFixed(1) }}%</span
                  >
                </div>
                <Progress :model-value="showCpuPercent(server)" class="h-1.5" />
              </div>

              <!-- RAM -->
              <div
                class="space-y-1"
                :style="{ '--primary': `hsl(${colors.memory.hsl})` }"
              >
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground flex items-center gap-1"
                    ><Database
                      class="h-3 w-3"
                      :style="{ color: colors.memory.color }"
                    />
                    {{ $t("common.ram") }}</span
                  >
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground">{{
                      showRamText(server)
                    }}</span>
                    <span class="font-medium"
                      >{{ showRamPercent(server).toFixed(1) }}%</span
                    >
                  </div>
                </div>
                <Progress :model-value="showRamPercent(server)" class="h-1.5" />
              </div>

              <!-- Load -->
              <div class="grid gap-2 text-xs">
                <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <Activity class="h-3.5 w-3.5 text-muted-foreground" />
                  <div class="flex flex-col">
                    <span class="text-xs text-muted-foreground">{{
                      $t("common.load")
                    }}</span>
                    <span class="font-medium font-mono">{{
                      formatLoad(server.load)
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- Network & Disk -->
              <div class="grid grid-cols-2 gap-4 pt-2 border-t">
                <!-- Network -->
                <div class="flex flex-col gap-1" v-if="server.network">
                  <span
                    class="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider"
                    ><NetworkIcon
                      class="h-3 w-3"
                      :style="{ color: colors.network.color }"
                    />{{ $t("common.network") }}</span
                  >
                  <div class="flex flex-col text-xs font-mono">
                    <div class="flex justify-between items-center">
                      <span class="text-muted-foreground">↓</span>
                      <span>{{ showNetworkSpeed(server, "rx") }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-muted-foreground">↑</span>
                      <span>{{ showNetworkSpeed(server, "tx") }}</span>
                    </div>
                  </div>
                </div>

                <!-- Disk -->
                <div
                  class="flex flex-col gap-1"
                  v-if="server.disk && server.disk.length > 0"
                  :style="{ '--primary': `hsl(${colors.disk.hsl})` }"
                >
                  <span
                    class="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider"
                    ><HardDrive
                      class="h-3 w-3"
                      :style="{ color: colors.disk.color }"
                    />{{ $t("common.disk") }}</span
                  >
                  <div class="flex items-center justify-between text-xs">
                    <span
                      class="truncate flex-1"
                      :title="(server.disk![0] as any).name"
                      >{{ (server.disk![0] as any).name }}</span
                    >
                    <span class="font-medium">{{
                      showDiskDisplay(server)
                    }}</span>
                  </div>
                  <Progress
                    :model-value="showDiskPercent(server)"
                    class="h-1 mt-1"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter
              class="pt-0 pb-3 text-[10px] text-muted-foreground flex justify-between px-6"
            >
              <span class="font-mono"
                >ID: {{ server.uuid.substring(0, 8) }}</span
              >
            </CardFooter>
          </Card>
        </router-link>
      </TransitionGroup>
      <FooterView />
    </div>
  </div>
</template>
