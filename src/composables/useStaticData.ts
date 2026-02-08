import { ref, watch } from 'vue'
import { useBackendStore } from './useBackendStore'

// Static data state (separate from dynamic)
const staticStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const staticError = ref('')
const staticServers = ref<any[]>([])
const staticWs = ref<WebSocket | null>(null)
let staticReconnectTimeout: any = null
let staticNextId = 1000 // Different starting ID to avoid conflicts

const { currentBackend } = useBackendStore()

const queryFields = ['cpu', 'system', 'gpu']

const scheduleReconnect = () => {
    if (staticReconnectTimeout) clearTimeout(staticReconnectTimeout)
    staticReconnectTimeout = setTimeout(() => {
        connect()
    }, 3000)
}

const sendQuery = () => {
    if (!staticWs.value || staticStatus.value !== 'connected' || !currentBackend.value) return

    const queryObj = {
        fields: queryFields,
        condition: [{"last": null}]
    }

    const payload = {
        jsonrpc: "2.0",
        id: staticNextId++,
        method: "agent_query_static",
        params: [currentBackend.value.token, queryObj]
    }

    try {
        staticWs.value.send(JSON.stringify(payload))
    } catch (e) {
        console.error("[Static] Send failed", e)
    }
}

const connect = () => {
    if (staticStatus.value === 'connected' || staticStatus.value === 'connecting') return

    if (!currentBackend.value) {
        staticError.value = 'No backend selected.'
        staticStatus.value = 'disconnected'
        return
    }

    const { url, token } = currentBackend.value
    if (!url || !token) {
         staticError.value = 'Invalid backend configuration.'
         staticStatus.value = 'disconnected'
         return
    }

    staticStatus.value = 'connecting'
    staticError.value = ''

    try {
        const socket = new WebSocket(url)
        staticWs.value = socket

        socket.onopen = () => {
            staticStatus.value = 'connected'
            staticError.value = ''
            sendQuery() // Fetch once
        }

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.result && Array.isArray(msg.result)) {
                    staticServers.value = msg.result
                    if (staticError.value) staticError.value = ''
                } else if (msg.result && msg.result.error_message) {
                    staticError.value = msg.result.error_message
                } else if (msg.error) {
                    console.error('[Static] RPC Error:', msg.error)
                    staticError.value = typeof msg.error === 'string' ? msg.error : (msg.error.message || JSON.stringify(msg.error))
                }
            } catch (e) {
                console.error('[Static] Failed to parse message:', event.data)
            }
        }

        socket.onclose = () => {
            staticStatus.value = 'disconnected'
            staticWs.value = null
            // Only reconnect if we still have a backend and it hasn't changed manually
            if (currentBackend.value) {
                scheduleReconnect()
            }
        }

        socket.onerror = (e) => {
            console.error('[Static] WebSocket Error:', e)
            staticStatus.value = 'disconnected'
        }
    } catch (e: any) {
        console.error('[Static] Connection failed:', e)
        staticStatus.value = 'disconnected'
        scheduleReconnect()
    }
}

// Watch for backend changes
watch(currentBackend, (newVal, oldVal) => {
    // If connection info changed
    if (newVal?.url !== oldVal?.url || newVal?.token !== oldVal?.token) {
        // Close existing
        if (staticWs.value) {
            staticWs.value.close() // onclose will trigger, but we want to ensure clean switch
            staticWs.value = null
        }
        staticStatus.value = 'disconnected'
        if (staticReconnectTimeout) clearTimeout(staticReconnectTimeout)
        
        if (newVal) {
             connect()
        }
    }
}, { deep: true })

export function useStaticData() {
    return {
        status: staticStatus,
        error: staticError,
        servers: staticServers,
        connect,
        refresh: sendQuery // Expose refresh if needed
    }
}
