<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Activity, Server, Zap, Database, HardDrive, Network, Cpu, Clock } from 'lucide-vue-next'

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
        } else if (msg.error) {
          console.error('RPC Error:', msg.error)
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
  <div class="container mx-auto p-6 space-y-6">
    
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-bold tracking-tight">NodeGet</h1>
        
      </div>
      <div class="text-sm text-muted-foreground">
        <Badge :variant="status === 'connected' ? 'default' : (status === 'connecting' ? 'secondary' : 'destructive')">
          {{ status === 'connected' ? 'Online' : (status === 'connecting' ? 'Connecting...' : 'Offline') }}
        </Badge>
      </div>
    </div>

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
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center gap-2 text-lg">
            <Server class="h-5 w-5 text-primary" />
            <span class="truncate" :title="getHostname(server)">{{ getHostname(server) }}</span>
          </CardTitle>
          <p class="text-xs text-muted-foreground truncate" :title="getOS(server)">{{ getOS(server) }}</p>
        </CardHeader>
        <CardContent class="grid gap-4 text-sm">
            
            <!-- CPU -->
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center text-muted-foreground">
                    <span class="flex items-center gap-1"><Cpu class="h-3 w-3" /> CPU</span>
                    <span class="font-medium text-foreground">{{ getCpuPercent(server).toFixed(1) }}%</span>
                </div>
                <Progress :model-value="getCpuPercent(server)" class="h-2" />
            </div>

            <!-- RAM -->
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center text-muted-foreground">
                    <span class="flex items-center gap-1"><Database class="h-3 w-3" /> RAM</span>
                    <span class="font-medium text-foreground">{{ getRamPercent(server).toFixed(1) }}%</span>
                </div>
                <Progress :model-value="getRamPercent(server)" class="h-2" />
                <div class="text-xs text-right text-muted-foreground">{{ getRamText(server) }}</div>
            </div>

            <!-- Load -->
            <div class="flex justify-between items-center border-t pt-2">
                 <span class="text-muted-foreground flex items-center gap-1"><Activity class="h-3 w-3" /> Load</span>
                 <span class="font-mono">{{ formatLoad(server.load) }}</span>
            </div>

            <!-- Network -->
            <div class="flex justify-between items-center border-t pt-2" v-if="server.network">
                 <span class="text-muted-foreground flex items-center gap-1"><Network class="h-3 w-3" /> Net</span>
                 <div class="text-right text-xs">
                    <div>{{ getNetworkSpeed(server, 'rx') }} ↓</div>
                    <div>{{ getNetworkSpeed(server, 'tx') }} ↑</div>
                 </div>
            </div>
            
             <!-- Disk -->
             <div class="flex justify-between items-center border-t pt-2" v-if="server.disk && server.disk.length > 0">
                 <span class="text-muted-foreground flex items-center gap-1"><HardDrive class="h-3 w-3" /> Disk </span>
                 <span class="text-xs">{{ getDiskUsage(server) }}</span>
            </div>


        </CardContent>
        <CardFooter class="pt-0 text-xs text-muted-foreground flex justify-between">
            <span>{{ server.uuid.substring(0, 8) }}...</span>
             <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {{ new Date(server.timestamp).toLocaleTimeString() }}</span>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

