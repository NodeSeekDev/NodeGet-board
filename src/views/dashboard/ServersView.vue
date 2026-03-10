<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
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

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

const router = useRouter();

const {
  status: dynamicStatus,
  error: dynamicError,
  servers: dynamicServers,
  connect: connectDynamic,
} = useDynamicData();

const {
  status: staticStatus,
  servers: staticServers,
  connect: connectStatic,
} = useStaticData();

const mergedServers = computed(() => {
  return dynamicServers.value.map((dServer) => {
    const sServer = staticServers.value.find((s) => s.uuid === dServer.uuid);
    if (!sServer) return dServer;

    return {
      ...dServer,
      cpu: { ...sServer.cpu, ...dServer.cpu },
      system: { ...sServer.system, ...dServer.system },
      gpu: sServer.gpu || [],
    };
  });
});

onMounted(() => {
  connectDynamic();
  connectStatic();
});

const goToServerDetail = (uuid: string) => {
  router.push(`/dashboard/node/${uuid}/ping`);
};
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Servers</h2>
        <p class="text-muted-foreground">
          Manage and monitor your servers in a list layout.
        </p>
      </div>
    </div>

    <Alert v-if="dynamicError" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ dynamicError }}</AlertDescription>
    </Alert>

    <div
      v-if="mergedServers.length === 0 && dynamicStatus === 'connected'"
      class="text-center py-10 text-muted-foreground"
    >
      Waiting for server data...
    </div>

    <div class="border rounded-md bg-card" v-if="mergedServers.length > 0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Server</TableHead>
            <TableHead>OS</TableHead>
            <TableHead>Uptime</TableHead>
            <TableHead>Load</TableHead>
            <TableHead class="w-[15%]">CPU</TableHead>
            <TableHead class="w-[15%]">RAM</TableHead>
            <TableHead class="w-[15%]">Disk</TableHead>
            <TableHead>Network</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="server in mergedServers"
            :key="server.uuid"
            class="cursor-pointer hover:bg-muted/50 transition-colors"
            @click="goToServerDetail(server.uuid)"
          >
            <!-- Server Info -->
            <TableCell>
              <div class="flex items-center gap-3">
                <div class="p-2 bg-primary/10 rounded-lg">
                  <Server class="h-4 w-4 text-primary" />
                </div>
                <div class="flex flex-col">
                  <span
                    class="font-medium truncate max-w-[150px]"
                    :title="showHostname(server)"
                  >
                    {{ showHostname(server) }}
                  </span>
                  <span class="text-[10px] text-muted-foreground font-mono">
                    {{ server.uuid.substring(0, 8) }}
                  </span>
                </div>
              </div>
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

            <!-- Uptime -->
            <TableCell>
              <div
                class="flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Clock class="h-3 w-3" />
                <span>{{ formatUptime(server.system.uptime) }}</span>
              </div>
            </TableCell>

            <!-- Load -->
            <TableCell>
              <div
                class="flex flex-col text-sm font-mono text-muted-foreground gap-1"
              >
                <div class="flex items-center gap-1">
                  <Activity class="h-3 w-3" />
                  <span>{{ formatLoad(server.load) }}</span>
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
                v-if="server.disk && server.disk.length > 0"
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
            <TableCell>
              <div
                class="flex flex-col gap-1 text-xs font-mono"
                v-if="server.network"
              >
                <div
                  class="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <div class="flex items-center gap-1">
                    <ArrowDownIcon class="h-3 w-3" />
                    <span>Rx</span>
                  </div>
                  <span>{{ showNetworkSpeed(server, "rx") }}</span>
                </div>
                <div
                  class="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <div class="flex items-center gap-1">
                    <ArrowUpIcon class="h-3 w-3" />
                    <span>Tx</span>
                  </div>
                  <span>{{ showNetworkSpeed(server, "tx") }}</span>
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
