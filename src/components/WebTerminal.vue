<script setup lang="ts">
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { wsRpcCall } from '@/composables/useWsRpc'
import { useFullscreen } from '@vueuse/core'
import { Maximize, Minimize, Maximize2, Minimize2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  rpcUrl: string
  token: string
  targetUuid: string
  autoConnect?: boolean
}>(), {
  autoConnect: true
})

const emit = defineEmits<{
  connected: []
  disconnected: [code: number]
  error: [message: string]
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const status = ref<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle')
const statusText = ref('Waiting')

const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(wrapperRef)
const isWindowFull = ref(false)

const toggleWindowFull = () => {
  isWindowFull.value = !isWindowFull.value
  nextTick(() => fit())
}

let socket: WebSocket | null = null
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let dataDisposable: { dispose: () => void } | null = null
let containerClickHandler: (() => void) | null = null
let heartbeatTimer: number | null = null

const initTerminal = () => {
  if (!containerRef.value) return
  if (terminal) return

  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: '"Cascadia Code", Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: '#000000'
    }
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value)
  fitAddon.fit()
  terminal.focus()

  containerClickHandler = () => terminal?.focus()
  containerRef.value.addEventListener('click', containerClickHandler)

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  resizeObserver.observe(containerRef.value)
}

const destroySocket = () => {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  if (dataDisposable) {
    dataDisposable.dispose()
    dataDisposable = null
  }

  if (socket) {
    socket.close()
    socket = null
  }
}

const disconnect = () => {
  destroySocket()
  status.value = 'disconnected'
  statusText.value = 'Disconnected'
}

const fit = () => {
  fitAddon?.fit()
}

const buildWsUrl = (pathname: string, query: Record<string, string> = {}) => {
  try {
    const parsed = new URL(props.rpcUrl)
    parsed.pathname = pathname
    parsed.search = ''
    parsed.hash = ''
    Object.entries(query).forEach(([key, value]) => {
      parsed.searchParams.set(key, value)
    })
    return parsed.toString()
  } catch {
    return ''
  }
}

const createTask = async () => {
  const rpcUrl = props.rpcUrl?.trim()
  const token = props.token?.trim()
  const targetUuid = props.targetUuid?.trim()
  const taskWebShellUrl = buildWsUrl('/auto_gen')

  if (!rpcUrl) throw new Error('RPC WebSocket URL is required')
  if (!token) throw new Error('Token is required')
  if (!targetUuid) throw new Error('Target UUID is required')
  if (!taskWebShellUrl) throw new Error('Task WebShell URL is invalid')

  await wsRpcCall(
    rpcUrl,
    'task_create_task',
    {
      token,
      target_uuid: targetUuid,
      task_type: {
        web_shell: taskWebShellUrl,
      },
    },
    { timeoutMs: 10000 },
  )
}

const connect = async () => {
  const targetUrl = buildWsUrl('/terminal', {
    agent_uuid: props.targetUuid?.trim(),
    token: props.token?.trim(),
  }).trim()
  if (!targetUrl) {
    status.value = 'error'
    statusText.value = 'Invalid URL'
    terminal?.writeln('\x1b[1;31mWebSocket URL is required\x1b[0m')
    emit('error', 'WebSocket URL is required')
    return
  }

  destroySocket()
  initTerminal()
  terminal?.clear()
  terminal?.writeln('Connecting to server...')

  status.value = 'connecting'
  statusText.value = 'Creating task'

  try {
    await createTask()
    terminal?.writeln('\x1b[1;32mWebShell task created successfully\x1b[0m')
  } catch (error: any) {
    const message = error?.message || 'Failed to create task'
    status.value = 'error'
    statusText.value = 'Task creation failed'
    terminal?.writeln(`\r\n\x1b[1;31m${message}\x1b[0m`)
    emit('error', message)
    return
  }

  statusText.value = 'Connecting'

  const ws = new WebSocket(targetUrl)
  ws.binaryType = 'arraybuffer'
  socket = ws

  ws.onopen = () => {
    status.value = 'connected'
    statusText.value = 'Connected'
    terminal?.writeln('\x1b[1;32mConnected successfully!\x1b[0m')

    dataDisposable = terminal?.onData((data: string) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    }) ?? null
    terminal?.focus()

    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer)
    }
    heartbeatTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send('')
      }
    }, 15000)

    emit('connected')
  }

  ws.onmessage = async (event) => {
    if (event.data instanceof ArrayBuffer) {
      terminal?.write(new Uint8Array(event.data))
      return
    }
    if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
      terminal?.write(await event.data.text())
      return
    }
    terminal?.write(String(event.data))
  }

  ws.onclose = (event) => {
    if (socket !== ws) return
    status.value = 'disconnected'
    statusText.value = `Disconnected (${event.code})`
    terminal?.writeln(`\r\n\x1b[1;31mDisconnected [code: ${event.code}]\x1b[0m`)
    emit('disconnected', event.code)
  }

  ws.onerror = () => {
    if (socket !== ws) return
    status.value = 'error'
    statusText.value = 'Connection error'
    terminal?.writeln('\r\n\x1b[1;31mWebSocket error occurred\x1b[0m')
    emit('error', 'WebSocket error occurred')
  }
}

watch(
  () => [props.rpcUrl, props.token, props.targetUuid],
  async () => {
    if (!props.autoConnect) return
    await nextTick()
    connect()
  }
)

onMounted(async () => {
  initTerminal()
  terminal?.writeln('Ready')

  if (props.autoConnect) {
    await nextTick()
    connect()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (containerRef.value && containerClickHandler) {
    containerRef.value.removeEventListener('click', containerClickHandler)
  }
  containerClickHandler = null
  destroySocket()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})

defineExpose({
  connect,
  disconnect,
  fit
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col box-border"
    :class="{
      'fixed inset-0 z-50 w-screen h-screen rounded-none border-0': isWindowFull
    }"
  >
    <div class="h-11 px-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
      <div class="text-sm text-muted-foreground">
        Status: <span class="font-mono">{{ statusText }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button size="icon" variant="ghost" @click="toggleWindowFull" title="Toggle Full Window">
          <Minimize2 v-if="isWindowFull" class="w-4 h-4" />
          <Maximize2 v-else class="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" @click="toggleFullscreen" title="Toggle Full Screen">
          <Minimize v-if="isFullscreen" class="w-4 h-4" />
          <Maximize v-else class="w-4 h-4" />
        </Button>
        <Button size="sm" variant="secondary" @click="connect">Reconnect</Button>
      </div>
    </div>
    <div
      ref="containerRef"
      class="w-full bg-black"
      :class="(isFullscreen || isWindowFull) ? 'flex-1 h-0' : 'h-[560px]'"
    />
  </div>
</template>
