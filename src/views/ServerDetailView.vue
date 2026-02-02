<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useServerData } from '@/composables/useServerData'
import { formatLoad, formatBytes, formatUptime } from '@/utils/format'
import { showHostname, showOS, showCpuPercent, showRamPercent, showRamText, showNetworkSpeed, showDiskUsage, showDiskPercent, showDiskDisplay } from '@/utils/show'

import { useRoute } from 'vue-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Activity, Server, Database, HardDrive, NetworkIcon, Cpu, Clock, ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import HeaderView from '@/components/HeaderView.vue'
import FooterView from '@/components/FooterView.vue'

const route = useRoute()
const uuid = route.params.uuid as string

const { status, error, servers, connect } = useServerData()

const server = computed(() => {
  return servers.value.find(s => s.uuid === uuid)
})


onMounted(() => {
  connect()
})
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <div class="container mx-auto p-6 space-y-6 flex-1">
      <HeaderView :status="status" />

      <div class="flex items-center gap-4">
        <Button variant="outline" size="icon" as-child>
            <router-link to="/">
                <ArrowLeft class="h-4 w-4" />
            </router-link>
        </Button>
        <h1 class="text-2xl font-bold tracking-tight">Server Details</h1>
      </div>

      <Alert v-if="error" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div v-if="status === 'connected' && !server" class="text-center py-10 text-muted-foreground">
        Server not found or waiting for data...
      </div>

      <div v-if="server" class="grid gap-6">
        <!-- Top Overview Card -->
        <Card>
            <CardHeader>
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-primary/10 rounded-xl">
                            <Server class="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle class="text-xl">{{ showHostname(server) }}</CardTitle>
                            <div class="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <Badge variant="outline" class="font-normal">{{ showOS(server) }}</Badge>
                                <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {{ formatUptime(server.system.uptime) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <!-- Metrics Grid -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
             <!-- CPU Card -->
             <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Cpu class="h-4 w-4" /> CPU Usage
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{{ showCpuPercent(server).toFixed(1) }}%</div>
                    <Progress :model-value="showCpuPercent(server)" class="h-2 mt-2" />
                    <div class="text-xs text-muted-foreground mt-2">
                        Load Average: {{ formatLoad(server.load) }}
                    </div>
                </CardContent>
             </Card>

             <!-- RAM Card -->
             <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Database class="h-4 w-4" /> Memory Usage
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{{ showRamPercent(server).toFixed(1) }}%</div>
                    <Progress :model-value="showRamPercent(server)" class="h-2 mt-2" />
                    <div class="text-xs text-muted-foreground mt-2">
                        {{ showRamText(server) }}
                    </div>
                </CardContent>
             </Card>

             <!-- Network Card -->
             <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <NetworkIcon class="h-4 w-4" /> Network
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col">
                             <span class="text-xs text-muted-foreground">Download</span>
                             <span class="text-lg font-mono font-medium">{{ showNetworkSpeed(server, 'rx') }}</span>
                        </div>
                        <div class="flex flex-col">
                             <span class="text-xs text-muted-foreground">Upload</span>
                             <span class="text-lg font-mono font-medium">{{ showNetworkSpeed(server, 'tx') }}</span>
                        </div>
                    </div>
                </CardContent>
             </Card>
             
              <!-- Disk Card -->
             <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <HardDrive class="h-4 w-4" /> Disk
                    </CardTitle>
                </CardHeader>
                <CardContent class="grid gap-4">
                    <div v-for="(disk, index) in server.disk" :key="index" class="space-y-1">
                         <div class="flex justify-between text-xs">
                             <span class="font-medium truncate max-w-[150px]" :title="disk.mount_point">{{ disk.mount_point }}</span>
                             <span class="text-muted-foreground">
                                {{ formatBytes(disk.total_space - disk.available_space) }} / {{ formatBytes(disk.total_space) }}
                             </span>
                         </div>
                         <Progress :model-value="((disk.total_space - disk.available_space) / disk.total_space) * 100" class="h-1.5" />
                    </div>
                     <div v-if="!server.disk || server.disk.length === 0" class="text-sm text-muted-foreground">
                        No disk information available
                    </div>
                </CardContent>
             </Card>

        </div>
      </div>
      <FooterView />
    </div>
  </div>
</template>
