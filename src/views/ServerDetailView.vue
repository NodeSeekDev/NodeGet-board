<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useServerData } from '@/composables/useServerData'
import { formatLoad, formatBytes, formatUptime } from '@/utils/format'
import { showHostname, showOS, showCpuPercent, showRamPercent, showRamText, showNetworkSpeed, showDiskUsage, showDiskPercent, showDiskDisplay } from '@/utils/show'

import { useRoute } from 'vue-router'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Container, Fish, Database, HardDrive, Network, Cpu, Clock, ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

import HeaderView from '@/components/HeaderView.vue'

const route = useRoute()
const uuid = route.params.uuid as string

const { status, error, servers, connect } = useServerData()

const activeTab = ref('cpu')

const server = computed(() => {
  return servers.value.find(s => s.uuid === uuid)
})

const tabs = [
    { id: 'cpu', label: 'CPU', icon: Cpu },
    { id: 'memory', label: 'Memory', icon: Database },
    { id: 'disk', label: 'Disk', icon: HardDrive },
    { id: 'network', label: 'Network', icon: Network },
]

onMounted(() => {
  connect()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-background text-foreground">
    <!-- Header -->
    <div class="border-b">
        <div class="container mx-auto py-3 px-4">
            <HeaderView :status="status" />
        </div>
    </div>

    <!-- Main Layout -->
    <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-72 border-r bg-muted/20 flex flex-col">
            <div class="p-4 border-b flex items-center gap-2">
                <Button variant="ghost" size="icon" as-child class="h-8 w-8 -ml-1">
                    <router-link to="/">
                        <ArrowLeft class="h-4 w-4" />
                    </router-link>
                </Button>
                <div class="overflow-hidden" v-if="server">
                     <h2 class="font-semibold truncate">{{ showHostname(server) }}</h2>
                     <p class="text-xs text-muted-foreground truncate">{{ showOS(server) }}</p>
                </div>
                <div v-else class="text-sm font-medium">Loading...</div>
            </div>
            
            <div class="flex-1 overflow-y-auto">
                <div class="p-2 space-y-1" v-if="server">
                    <button 
                        v-for="tab in tabs" 
                        :key="tab.id"
                        @click="activeTab = tab.id"
                        :class="[
                            'w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors border border-transparent',
                            activeTab === tab.id 
                                ? 'bg-primary/20 border-border shadow-sm text-foreground' 
                                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                        ]"
                    >
                        <div :class="[
                            'p-2 rounded-md',
                            activeTab === tab.id ? 'bg-primary/10' : 'bg-muted'
                        ]">
                            <component :is="tab.icon" :class="[
                                'h-5 w-5',
                                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
                            ]" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm">{{ tab.label }}</div>
                            <div class="text-xs text-muted-foreground mt-0.5 font-mono">
                                <span v-if="tab.id === 'cpu'">{{ showCpuPercent(server).toFixed(1) }}%</span>
                                <span v-else-if="tab.id === 'memory'">{{ showRamPercent(server).toFixed(1) }}%</span>
                                <span v-else-if="tab.id === 'disk'">{{ showDiskDisplay(server) }}</span>
                                <span v-else-if="tab.id === 'network'">{{ showNetworkSpeed(server, 'rx') }}</span>
                            </div>
                        </div>
                        <div class="w-1 h-8 rounded-full bg-primary/20 overflow-hidden" v-if="['cpu', 'memory', 'disk'].includes(tab.id)">
                            <div 
                                class="w-full bg-primary transition-all duration-500 rounded-full"
                                :style="{ 
                                    height: (
                                        tab.id === 'cpu' ? showCpuPercent(server) : 
                                        tab.id === 'memory' ? showRamPercent(server) : 
                                        tab.id === 'disk' ? showDiskPercent(server) : 
                                        0
                                    ) + '%',
                                    
                                }"
                            ></div>
                        </div>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col min-w-0 bg-background">
             <div v-if="!server" class="flex-1 flex items-center justify-center text-muted-foreground">
                <div class="flex flex-col items-center gap-2">
                    <div v-if="error" class="text-destructive flex items-center gap-2">
                         <AlertCircle class="h-5 w-5" /> {{ error }}
                    </div>
                    <span v-else>Connecting to server...</span>
                </div>
             </div>
             
             <div v-else class="flex-1 p-6 overflow-y-auto">
                <div class="max-w-5xl mx-auto space-y-6">
                    <div class="flex items-center justify-between">
                         <h1 class="text-3xl font-bold tracking-light">{{ tabs.find(t => t.id === activeTab)?.label }}</h1>
                         <Badge variant="outline" class="font-mono text-xs">
                             <Clock class="h-3 w-3 mr-1" />
                             Uptime: {{ formatUptime(server.system.uptime) }}
                         </Badge>
                    </div>

                    <!-- CPU View -->
                    <div v-if="activeTab === 'cpu'" class="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle class="text-sm font-medium text-muted-foreground">Total Utilization</CardTitle>
                                <div class="text-4xl font-bold tracking-tighter">{{ showCpuPercent(server).toFixed(1) }}%</div>
                            </CardHeader>
                            <CardContent>
                                <div class="h-[200px] w-full bg-muted/10 rounded-md border flex items-end p-1 relative overflow-hidden group">
                                     <div 
                                        class="w-full bg-primary/20 backdrop-blur-sm transition-all duration-500 ease-in-out border-t-2 border-primary"
                                        :style="{ height: showCpuPercent(server) + '%' }"
                                     ></div>
                                     <div class="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-6xl select-none group-hover:opacity-0 transition-opacity">
                                         CPU
                                     </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                <div class="text-xs text-muted-foreground mb-1">Load Average</div>
                                <div class="text-lg font-mono">{{ formatLoad(server.load) }}</div>
                            </div>
                            <div class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                <div class="text-xs text-muted-foreground mb-1">Cores</div>
                                <div class="text-lg font-mono">{{ server.cpu.per_core.length }}</div>
                            </div>
                             <div class="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                <div class="text-xs text-muted-foreground mb-1">Model</div>
                                <div class="text-sm font-medium truncate" :title="'unknown'">unknown</div>
                            </div>
                        </div>
                    </div>

                    <!-- Memory View -->
                    <div v-if="activeTab === 'memory'" class="space-y-6">
                         <div class="grid md:grid-cols-2 gap-6">
                             <Card>
                                 <CardHeader>
                                     <CardTitle class="text-sm font-medium text-muted-foreground">Memory Usage</CardTitle>
                                     <div class="text-3xl font-bold">{{ showRamPercent(server).toFixed(1) }}%</div>
                                     <CardDescription class="font-mono">{{ showRamText(server) }}</CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                     <Progress :model-value="showRamPercent(server)" class="h-4" />
                                     <div class="mt-4 space-y-2">
                                         <div class="flex justify-between text-sm">
                                             <span class="text-muted-foreground">Used</span>
                                             <span class="font-mono">{{ formatBytes(server.ram.used_memory || server.ram.used) }}</span>
                                         </div>
                                         <div class="flex justify-between text-sm">
                                             <span class="text-muted-foreground">Available</span>
                                             <span class="font-mono">{{ formatBytes((server.ram.total_memory || server.ram.total) - (server.ram.used_memory || server.ram.used)) }}</span>
                                         </div>
                                     </div>
                                 </CardContent>
                             </Card>
                             
                             <Card>
                                 <CardHeader>
                                     <CardTitle class="text-sm font-medium text-muted-foreground">Swap Usage</CardTitle>
                                     <div class="text-3xl font-bold">
                                         {{ server.ram.total_swap ? ((server.ram.used_swap / server.ram.total_swap) * 100).toFixed(1) : 0 }}%
                                     </div>
                                      <CardDescription class="font-mono">
                                         {{ formatBytes(server.ram.used_swap || 0) }} / {{ formatBytes(server.ram.total_swap || 0) }}
                                     </CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                      <Progress :model-value="server.ram.total_swap ? ((server.ram.used_swap / server.ram.total_swap) * 100) : 0" class="h-4" />
                                 </CardContent>
                             </Card>
                         </div>
                    </div>

                    <!-- Disk View -->
                    <div v-if="activeTab === 'disk'" class="space-y-6">
                        <div class="grid gap-4">
                            <Card v-for="(disk, index) in server.disk" :key="index">
                                <CardHeader class="pb-2">
                                     <div class="flex items-center justify-between">
                                         <CardTitle class="text-base font-medium flex items-center gap-2">
                                             <HardDrive class="h-4 w-4" /> 
                                             <span>{{ disk.device_name || 'Disk ' + index }}</span>
                                             <Badge variant="secondary" class="ml-2 font-mono">{{ disk.mount_point }}</Badge>
                                         </CardTitle>
                                         <span class="text-sm text-muted-foreground font-mono">{{ disk.kind }}</span>
                                     </div>
                                </CardHeader>
                                <CardContent>
                                     <div class="flex items-end justify-between mb-2">
                                         <div class="text-2xl font-bold">
                                             {{ ((1 - (disk.available_space / disk.total_space)) * 100).toFixed(0) }}%
                                         </div>
                                         <div class="text-sm text-muted-foreground font-mono">
                                             {{ formatBytes(disk.total_space - disk.available_space) }} used of {{ formatBytes(disk.total_space) }}
                                         </div>
                                     </div>
                                     <Progress :model-value="((1 - (disk.available_space / disk.total_space)) * 100)" class="h-3" />
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <!-- Network View -->
                    <div v-if="activeTab === 'network'" class="space-y-6">
                        <div class="grid md:grid-cols-2 gap-6">
                            <Card class="">
                                <CardContent class="pt-2">
                                     <div class="text-sm font-medium text-muted-foreground mb-2">Total Download</div>
                                     <div class="text-3xl font-bold font-mono">{{ showNetworkSpeed(server, 'rx') }}</div>
                                </CardContent>
                            </Card>
                            <Card class="">
                                <CardContent class="pt-2">
                                     <div class="text-sm font-medium text-muted-foreground mb-2">Total Upload</div>
                                     <div class="text-3xl font-bold font-mono">{{ showNetworkSpeed(server, 'tx') }}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Network Interfaces</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div class="space-y-4">
                                    <div v-for="(iface, index) in server.network.interfaces" :key="index" class="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                        <div class="flex items-center gap-3">
                                            <div class="h-8 w-8 rounded bg-background flex items-center justify-center border">
                                            <Fish v-if="iface.interface_name.startsWith('docker')" class="h-4 w-4 text-muted-foreground" />
                                            <Container v-else-if="iface.interface_name.startsWith('podman')" class="h-4 w-4 text-muted-foreground" />
                                            <Network v-else class="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <div class="font-medium">{{ iface.interface_name }}</div>
                                                <div class="text-xs text-muted-foreground font-mono" v-if="iface.ip_address">{{ iface.ip_address }}</div>
                                            </div>
                                        </div>
                                        <div class="text-right text-xs font-mono space-y-1">
                                            <div class="text-emerald-500">↓ {{ formatBytes(iface.receive_speed) }}/s</div>
                                            <div class="text-blue-500">↑ {{ formatBytes(iface.transmit_speed) }}/s</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
             </div>
        </main>
    </div>
  </div>
</template>
