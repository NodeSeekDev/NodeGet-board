<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
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
  isOnline,
  distroLogo,
  virtLabel,
  flagUrl,
} from "@/utils/show";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Server,
  Database,
  HardDrive,
  NetworkIcon,
  Cpu,
  Clock,
  Activity,
  ArrowDownIcon,
  ArrowUpIcon,
  Network,
} from "lucide-vue-next";

definePage({
  meta: {
    title: "router.overview",
    icon: Server,
    order: 1,
    group: "router.group.monitor",
  },
});

const router = useRouter();

const { servers, loading, error, inactive, start, stop } = useOverviewData();

const selectedTag = ref("all");

const allTags = computed(() => {
  const set = new Set<string>();
  for (const s of servers.value) {
    for (const t of s.tags ?? []) set.add(t);
  }
  return Array.from(set).sort();
});

const filteredServers = computed(() => {
  if (selectedTag.value === "all") return servers.value;
  return servers.value.filter((s) =>
    (s.tags ?? []).includes(selectedTag.value),
  );
});

onMounted(() => {
  start();
});

onUnmounted(() => {
  stop();
});

const goToServerDetail = (uuid: string) => {
  router.push({
    name: "/dashboard/node/[uuid]/status",
    params: { uuid },
  });
};
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Servers</h2>
        <p class="text-muted-foreground">
          Manage and monitor your servers in a list layout.
        </p>
      </div>
      <div v-if="allTags.length > 0" class="w-40 shrink-0">
        <Select v-model="selectedTag">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{
              $t("dashboard.batchExec.selectTag")
            }}</SelectItem>
            <SelectItem v-for="t in allTags" :key="t" :value="t">{{
              t
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div
      v-if="servers.length === 0 && loading"
      class="text-center py-10 text-muted-foreground"
    >
      Loading server data...
    </div>

    <div
      v-if="servers.length === 0 && !loading"
      class="text-center py-10 text-muted-foreground"
    >
      No servers found.
    </div>

    <div
      v-if="servers.length > 0 && filteredServers.length === 0"
      class="text-center py-10 text-muted-foreground"
    >
      No servers match the selected tag.
    </div>

    <div class="border rounded-md bg-card" v-if="filteredServers.length > 0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-8" />
            <TableHead>Server</TableHead>
            <TableHead class="w-12 text-center">Region</TableHead>
            <TableHead>OS</TableHead>
            <TableHead class="w-[80px]">Virt</TableHead>
            <TableHead>Uptime</TableHead>
            <TableHead>Load</TableHead>
            <TableHead class="w-[15%]">CPU</TableHead>
            <TableHead class="w-[15%]">RAM</TableHead>
            <TableHead class="w-[15%]">Disk</TableHead>
            <TableHead class="w-[150px]">Network</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="server in filteredServers"
            :key="server.uuid"
            class="cursor-pointer hover:bg-muted/50 transition-colors"
            :class="{ 'opacity-60': !inactive && !isOnline(server) }"
            @click="goToServerDetail(server.uuid)"
          >
            <!-- Online dot -->
            <TableCell>
              <div class="flex items-center justify-center">
                <span
                  :title="
                    inactive
                      ? 'Inactive'
                      : isOnline(server)
                        ? 'Online'
                        : 'Offline'
                  "
                  class="inline-block w-2 h-2 rounded-full shrink-0"
                  :class="
                    inactive
                      ? 'bg-gray-400 ring-2 ring-gray-400/25'
                      : isOnline(server)
                        ? 'bg-emerald-500 ring-2 ring-emerald-500/25'
                        : 'bg-rose-500 ring-2 ring-rose-500/25'
                  "
                />
              </div>
            </TableCell>

            <!-- Server Info -->
            <TableCell>
              <div class="flex items-center gap-3">
                <img
                  v-if="distroLogo(server)"
                  :src="distroLogo(server)"
                  alt=""
                  class="w-5 h-5 shrink-0 object-contain"
                  loading="lazy"
                />
                <div v-else class="p-2 bg-primary/10 rounded-lg">
                  <Server class="h-4 w-4 text-primary" />
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-1">
                    <span
                      class="font-medium truncate max-w-[150px]"
                      :title="server.customName || showHostname(server)"
                    >
                      {{ server.customName || showHostname(server) }}
                    </span>
                    <Badge
                      v-if="server.hidden"
                      variant="secondary"
                      class="ml-1 text-xs"
                      >隐藏</Badge
                    >
                  </div>
                  <span class="text-[10px] text-muted-foreground font-mono">
                    {{ server.uuid.substring(0, 8) }}
                  </span>
                </div>
              </div>
            </TableCell>

            <!-- Region (flag) -->
            <TableCell class="text-center">
              <img
                v-if="flagUrl(server.region)"
                :src="flagUrl(server.region)"
                :alt="server.region"
                :title="server.region"
                loading="lazy"
                class="inline-block w-5 h-3.5 rounded-[1px] object-cover shadow-sm"
              />
              <span v-else class="text-muted-foreground text-sm">—</span>
            </TableCell>

            <!-- OS -->
            <TableCell>
              <Badge
                variant="outline"
                class="font-normal text-xs"
                :title="showOS(server)"
              >
                {{ showOS(server) }}
              </Badge>
            </TableCell>

            <!-- Virtualization -->
            <TableCell>
              <Badge
                v-if="virtLabel(server)"
                variant="secondary"
                class="text-[10px] uppercase tracking-wide"
              >
                {{ virtLabel(server) }}
              </Badge>
              <span v-else class="text-muted-foreground text-sm">—</span>
            </TableCell>

            <!-- Uptime -->
            <TableCell>
              <div
                class="flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Clock class="h-3 w-3" />
                <span>{{ formatUptime(server.uptime ?? 0) }}</span>
              </div>
            </TableCell>

            <!-- Load -->
            <TableCell>
              <div
                class="flex flex-col text-sm font-mono text-muted-foreground gap-1"
              >
                <div class="flex items-center gap-1">
                  <Activity class="h-3 w-3" />
                  <span>{{
                    formatLoad({
                      load_one: server.load_one,
                      load_five: server.load_five,
                      load_fifteen: server.load_fifteen,
                    })
                  }}</span>
                </div>
              </div>
            </TableCell>

            <!-- CPU -->
            <TableCell>
              <div
                class="space-y-1.5"
                :style="{ '--primary': `hsl(${colors.cpu.hsl})` }"
              >
                <div class="flex justify-between text-xs">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    <Cpu class="h-3 w-3" :style="{ color: colors.cpu.color }" />
                    CPU
                  </span>
                  <span class="font-medium"
                    >{{ showCpuPercent(server).toFixed(1) }}%</span
                  >
                </div>
                <Progress :model-value="showCpuPercent(server)" class="h-1.5" />
              </div>
            </TableCell>

            <!-- RAM -->
            <TableCell>
              <div
                class="space-y-1.5"
                :style="{ '--primary': `hsl(${colors.memory.hsl})` }"
              >
                <div class="flex justify-between text-xs">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    <Database
                      class="h-3 w-3"
                      :style="{ color: colors.memory.color }"
                    />
                    Mem
                  </span>
                  <span class="font-medium"
                    >{{ showRamPercent(server).toFixed(1) }}%</span
                  >
                </div>
                <Progress :model-value="showRamPercent(server)" class="h-1.5" />
              </div>
            </TableCell>

            <!-- Disk -->
            <TableCell>
              <div
                class="space-y-1.5"
                v-if="server.total_space"
                :style="{ '--primary': `hsl(${colors.disk.hsl})` }"
              >
                <div class="flex justify-between text-xs">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    <HardDrive
                      class="h-3 w-3"
                      :style="{ color: colors.disk.color }"
                    />
                    Disk
                  </span>
                  <span class="font-medium"
                    >{{ showDiskPercent(server).toFixed(1) }}%</span
                  >
                </div>
                <Progress
                  :model-value="showDiskPercent(server)"
                  class="h-1.5"
                />
              </div>
              <div v-else class="text-xs text-muted-foreground">N/A</div>
            </TableCell>

            <!-- Network -->
            <TableCell class="w-[150px]">
              <div
                class="flex flex-col gap-1 text-xs font-mono"
                v-if="
                  server.receive_speed != null || server.transmit_speed != null
                "
              >
                <div
                  class="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <div class="flex items-center gap-1">
                    <ArrowDownIcon class="h-3 w-3" />
                    <span>Rx</span>
                  </div>
                  <span class="tabular-nums text-right whitespace-nowrap">{{
                    showNetworkSpeed(server, "rx")
                  }}</span>
                </div>
                <div
                  class="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <div class="flex items-center gap-1">
                    <ArrowUpIcon class="h-3 w-3" />
                    <span>Tx</span>
                  </div>
                  <span class="tabular-nums text-right whitespace-nowrap">{{
                    showNetworkSpeed(server, "tx")
                  }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-muted-foreground">N/A</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
