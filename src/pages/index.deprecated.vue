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

const sortedServers = computed(() =>
  [...servers.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
);

const status = computed(() =>
  loading.value ? "connecting" : error.value ? "disconnected" : "connected",
);

onMounted(() => start());
onUnmounted(() => stop());
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <div class="container mx-auto flex-1 space-y-6 p-6">
      <HeaderView :status="status" />

      <Alert v-if="error" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>{{ $t("common.error") }}</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div
        v-if="servers.length === 0 && !loading"
        class="py-10 text-center text-muted-foreground"
      >
        {{ $t("home.waitingData") }}
      </div>

      <TransitionGroup
        tag="div"
        name="list"
        class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <router-link
          v-for="server in sortedServers"
          :key="server.uuid"
          :to="{ name: '/server-detail/[uuid]', params: { uuid: server.uuid } }"
          class="block h-full"
        >
          <Card class="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader class="pb-3">
              <div class="flex items-start justify-between">
                <CardTitle
                  class="flex items-center gap-2 text-base font-medium"
                >
                  <div class="rounded-lg bg-primary/10 p-2">
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
                      class="mt-1 flex items-center gap-1 text-xs font-normal text-muted-foreground"
                    >
                      <Clock class="h-3 w-3" />
                      {{ formatUptime(server.uptime ?? 0) }}
                    </span>
                  </div>
                </CardTitle>
                <Badge
                  variant="outline"
                  class="text-xs font-normal"
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
                  <span class="flex items-center gap-1 text-muted-foreground"
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
                  <span class="flex items-center gap-1 text-muted-foreground"
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
                <div class="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                  <Activity class="h-3.5 w-3.5 text-muted-foreground" />
                  <div class="flex flex-col">
                    <span class="text-xs text-muted-foreground">{{
                      $t("common.load")
                    }}</span>
                    <span class="font-mono font-medium">{{
                      formatLoad({
                        load_one: server.load_one,
                        load_five: server.load_five,
                        load_fifteen: server.load_fifteen,
                      })
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- Network & Disk -->
              <div class="grid grid-cols-2 gap-4 border-t pt-2">
                <!-- Network -->
                <div
                  class="flex flex-col gap-1"
                  v-if="
                    server.receive_speed != null ||
                    server.transmit_speed != null
                  "
                >
                  <span
                    class="flex items-center gap-1 text-[10px] tracking-wider text-muted-foreground uppercase"
                    ><NetworkIcon
                      class="h-3 w-3"
                      :style="{ color: colors.network.color }"
                    />{{ $t("common.network") }}</span
                  >
                  <div class="flex flex-col font-mono text-xs">
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground">↓</span>
                      <span>{{ showNetworkSpeed(server, "rx") }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground">↑</span>
                      <span>{{ showNetworkSpeed(server, "tx") }}</span>
                    </div>
                  </div>
                </div>

                <!-- Disk -->
                <div
                  class="flex flex-col gap-1"
                  v-if="server.total_space"
                  :style="{ '--primary': `hsl(${colors.disk.hsl})` }"
                >
                  <span
                    class="flex items-center gap-1 text-[10px] tracking-wider text-muted-foreground uppercase"
                    ><HardDrive
                      class="h-3 w-3"
                      :style="{ color: colors.disk.color }"
                    />{{ $t("common.disk") }}</span
                  >
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-medium">{{
                      showDiskDisplay(server)
                    }}</span>
                  </div>
                  <Progress
                    :model-value="showDiskPercent(server)"
                    class="mt-1 h-1"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter
              class="flex justify-between px-6 pt-0 pb-3 text-[10px] text-muted-foreground"
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
