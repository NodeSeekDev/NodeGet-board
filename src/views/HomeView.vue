<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Activity, Server, Database, HardDrive, Network, Cpu, Clock, Timer, NetworkIcon } from 'lucide-vue-next'
import HeaderView from '@/components/HeaderView.vue'
import FooterView from '@/components/FooterView.vue'

const status = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const error = ref('')
const servers = ref<any[]>([])
const ws = ref<WebSocket | null>(null)
let pollInterval: any = null
let reconnectTimeout: any = null

const token = import.meta.env.VITE_BACKEND_TOKEN
const wsUrl = import.meta.env.VITE_BACKEND_WS

const queryFields = ['cpu', 'ram', 'load', 'system', 'disk', 'network', 'gpu']
let nextId = 1

const connect = () => {
  if (status.value === 'connected' || status.value === 'connecting') return

  if (!wsUrl || !token) {
    error.value = 'Missing VITE_BACKEND_WS or VITE_BACKEND_TOKEN in environment.'
    return
  }

  status.value = 'connecting'
  error.value = ''

  try {
    const socket = new WebSocket(wsUrl)
    ws.value = socket

    socket.onopen = () => {
      status.value = 'connected'
      error.value = ''
      startPolling()
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.result && Array.isArray(msg.result)) {
          servers.value = msg.result
          if (error.value) error.value = ''
        } else if (msg.result && msg.result.error_message) {
          error.value = msg.result.error_message
          stopPolling()
        } else if (msg.error) {
          console.error('RPC Error:', msg.error)
          error.value = typeof msg.error === 'string' ? msg.error : (msg.error.message || JSON.stringify(msg.error))
          stopPolling()
        }
      } catch (e) {
        console.error('Failed to parse message:', event.data)
      }
    }

    socket.onclose = () => {
      status.value = 'disconnected'
      ws.value = null
      stopPolling()
      scheduleReconnect()
    }

    socket.onerror = (e) => {
      console.error('WebSocket Error:', e)
      status.value = 'disconnected'
    }
  } catch (e: any) {
    console.error('Connection failed:', e)
    status.value = 'disconnected'
    scheduleReconnect()
  }
}

const scheduleReconnect = () => {
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  reconnectTimeout = setTimeout(() => {
    connect()
  }, 3000)
}

const startPolling = () => {
  if (pollInterval) clearInterval(pollInterval)
  sendQuery()
  pollInterval = setInterval(sendQuery, 1000)
}

const stopPolling = () => {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = null
}

const sendQuery = () => {
  if (!ws.value || status.value !== 'connected') return

  const queryObj = {
    fields: queryFields,
    condition: [{"last": null}]
  }

  const payload = {
    jsonrpc: "2.0",
    id: nextId++,
    method: "agent_query_dynamic",
    params: [token, queryObj]
  }

  try {
    ws.value.send(JSON.stringify(payload))
  } catch (e) {
    console.error("Send failed", e)
  }
}

// Helpers
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const getHostname = (server: any) => {
  if (server.system && server.system_host_name) {
    return server.system.system_host_name
  }
  return 'Server'
}

const getOS = (server: any) => {
    if (server.system && server.system.system_name) return server.system.system_name + ' ' + (server.system.system_os_version || '')
    return 'Unknown OS' 
}

const getCpuPercent = (server: any): number => {
    if (server.cpu) {

        if (typeof server.cpu.total_cpu_usage === 'number') return server.cpu.total_cpu_usage
    }
    return 0
}

const getRamPercent = (server: any): number => {
    if (server.ram) {
        const used = server.ram.used_memory || server.ram.used || 0
        const total = server.ram.total_memory || server.ram.total || 1
        return (used / total) * 100
    }
    return 0
}

const getRamText = (server: any) => {
    if (server.ram) {
        const used = server.ram.used_memory || server.ram.used || 0
        const total = server.ram.total_memory || server.ram.total || 0
        return `${formatBytes(used)} / ${formatBytes(total)}`
    }
    return 'N/A'
}

const formatLoad = (load: any) => {
    if (!load) return '- / - / -'
    const one = load.one ?? load.load1 ?? '-'
    const five = load.five ?? load.load5 ?? '-'
    const fifteen = load.fifteen ?? load.load15 ?? '-'
    return `${one} / ${five} / ${fifteen}`
}

const getNetworkSpeed = (server: any, type: 'rx' | 'tx') => {
    if (!server.network) return '0 B/s'
    let totalSpeed = 0
    
    for (const iface of server.network.interfaces) {
        //skip lo
        if (iface.interface_name === 'lo') continue;
        
        if (type === 'rx') totalSpeed += (iface.receive_speed || 0)
        if (type === 'tx') totalSpeed += (iface.transmit_speed || 0)
    }
    
    return formatBytes(totalSpeed) + '/s'
}

const getDiskUsage = (server: any) => {
    if (server.disk && Array.isArray(server.disk) && server.disk.length > 0) {
        const root = server.disk.find((d: any) => d.mount_point === '/') || server.disk[0]
        if (root) {
            const total = root.total_space
            const available = root.available_space
            const used = total - available
            const percent = (used / total) * 100
            return `${root.mount_point}: ${Math.round(percent)}%`
        }
    }
    return 'N/A'
}

const getDiskPercent = (server: any) => {
    const text = getDiskUsage(server)
    if (text === 'N/A') return 0
    const parts = text.split(': ')
    if (parts.length === 2) {
        return parseFloat(parts[1] as string)
    }
    return 0
}

const getDiskDisplay = (server: any) => {
    const text = getDiskUsage(server)
    if (text === 'N/A') return 'N/A'
    const parts = text.split(': ')
    return parts.length === 2 ? parts[1] : 'N/A'
}


const formatUptime = (uptime: number) => {
  if (!uptime) return '0m'
  const days = Math.floor(uptime / (3600 * 24))
  const hours = Math.floor((uptime % (3600 * 24)) / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  
  return parts.join(' ') || '< 1m'
}


onMounted(() => {
  connect()
})

onUnmounted(() => {
  stopPolling()
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  if (ws.value) ws.value.close()
})

</script>

<template>
  <div class="flex flex-col min-h-screen">
    <div class="container mx-auto p-6 space-y-6 flex-1">
    
    <HeaderView :status="status" />

    <Alert v-if="error" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div v-if="servers.length === 0 && status === 'connected'" class="text-center py-10 text-muted-foreground">
      Waiting for server data...
    </div>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <Card v-for="server in servers" :key="server.uuid" class="hover:shadow-md transition-shadow">
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <CardTitle class="flex items-center gap-2 text-base font-medium">
              <div class="p-2 bg-primary/10 rounded-lg">
                <Server class="h-4 w-4 text-primary" />
              </div>
              <div class="flex flex-col">
                <span class="truncate leading-none" :title="getHostname(server)">{{ getHostname(server) }}</span>
                <span class="text-[10px] text-muted-foreground font-normal mt-1 flex items-center gap-1">
                   <Clock class="h-3 w-3" /> {{ formatUptime(server.system.uptime) }}
                </span>
              </div>
            </CardTitle>
             <Badge variant="outline" class="font-normal text-xs" :title="getOS(server)">{{ getOS(server) }}</Badge>
          </div>
        </CardHeader>
        <CardContent class="grid gap-4 text-sm">
            

            <!-- CPU -->
            <div class="space-y-1">
                <div class="flex justify-between text-xs">
                    <span class="text-muted-foreground flex items-center gap-1"><Cpu class="h-3 w-3" /> CPU</span>
                    <span class="font-medium">{{ getCpuPercent(server).toFixed(1) }}%</span>
                </div>
                <Progress :model-value="getCpuPercent(server)" class="h-1.5" />
            </div>

            <!-- RAM -->
            <div class="space-y-1">
                <div class="flex justify-between text-xs">
                    <span class="text-muted-foreground flex items-center gap-1"><Database class="h-3 w-3" /> RAM</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-muted-foreground">{{ getRamText(server) }}</span>
                        <span class="font-medium">{{ getRamPercent(server).toFixed(1) }}%</span>
                    </div>
                </div>
                <Progress :model-value="getRamPercent(server)" class="h-1.5" />
            </div>

            <!-- Load -->
            <div class="grid gap-2 text-xs">
                <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                   <Activity class="h-3.5 w-3.5 text-muted-foreground" />
                   <div class="flex flex-col">
                        <span class="text-xs text-muted-foreground">Load</span>
                        <span class="font-medium font-mono">{{ formatLoad(server.load) }}</span>
                   </div>
                </div>
            </div>

            <!-- Network & Disk -->
             <div class="grid grid-cols-2 gap-4 pt-2 border-t">
                 <!-- Network -->
                <div class="flex flex-col gap-1" v-if="server.network">
                     <span class="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider"><NetworkIcon class="h-3 w-3" />Network</span>
                     <div class="flex flex-col text-xs font-mono">
                         <div class="flex justify-between items-center">
                            <span class="text-muted-foreground">↓</span>
                            <span>{{ getNetworkSpeed(server, 'rx') }}</span>
                         </div>
                         <div class="flex justify-between items-center">
                            <span class="text-muted-foreground">↑</span>
                            <span>{{ getNetworkSpeed(server, 'tx') }}</span>
                         </div>
                     </div>
                </div>

                <!-- Disk -->
                <div class="flex flex-col gap-1" v-if="server.disk && server.disk.length > 0">
                    <span class="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider"><HardDrive class="h-3 w-3" />Disk</span>
                    <div class="flex items-center justify-between text-xs">
                         <span class="truncate flex-1" :title="server.disk[0].name">{{ server.disk[0].name }}</span>
                         <span class="font-medium">{{ getDiskDisplay(server) }}</span>
                    </div>
                     <Progress :model-value="getDiskPercent(server)" class="h-1 mt-1" />
                </div>
             </div>
        </CardContent>
        <CardFooter class="pt-0 pb-3 text-[10px] text-muted-foreground flex justify-between px-6">
            <span class="font-mono">ID: {{ server.uuid.substring(0, 8) }}</span>
        </CardFooter>
      </Card>
    </div>
    <FooterView />
  </div>
  </div>
</template>

