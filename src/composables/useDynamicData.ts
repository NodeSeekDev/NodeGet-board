import { ref, watch } from 'vue'
import { useBackendStore } from './useBackendStore'

// Dynamic data state (separate from static)
const dynamicStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const dynamicError = ref('')
const dynamicServers = ref<any[]>([])
const dynamicWs = ref<WebSocket | null>(null)
let dynamicPollInterval: any = null
let dynamicReconnectTimeout: any = null
let dynamicNextId = 1 // Different starting ID to avoid conflicts

const { currentBackend } = useBackendStore()

const queryFields = ['cpu', 'ram', 'load', 'system', 'disk', 'network']

const scheduleReconnect = () => {
    if (dynamicReconnectTimeout) clearTimeout(dynamicReconnectTimeout)
    dynamicReconnectTimeout = setTimeout(() => {
        connect()
    }, 3000)
}

const sendQuery = () => {
    if (!dynamicWs.value || dynamicStatus.value !== 'connected' || !currentBackend.value) return

    const queryObj = {
        fields: queryFields,
        condition: [{"last": null}]
    }

    const payload = {
        jsonrpc: "2.0",
        id: dynamicNextId++,
        method: "agent_query_dynamic",
        params: [currentBackend.value.token, queryObj]
    }

    try {
        dynamicWs.value.send(JSON.stringify(payload))
    } catch (e) {
        console.error("[Dynamic] Send failed", e)
    }
}

const startPolling = () => {
    if (dynamicPollInterval) clearInterval(dynamicPollInterval)
    sendQuery()
    dynamicPollInterval = setInterval(sendQuery, 1000)
}

const stopPolling = () => {
    if (dynamicPollInterval) clearInterval(dynamicPollInterval)
    dynamicPollInterval = null
}

const connect = () => {
    if (dynamicStatus.value === 'connected' || dynamicStatus.value === 'connecting') return

    if (!currentBackend.value) {
        dynamicError.value = 'No backend selected.'
        dynamicStatus.value = 'disconnected'
        return
    }

    const { url, token } = currentBackend.value
    if (!url || !token) {
        dynamicError.value = 'Invalid backend configuration.'
        dynamicStatus.value = 'disconnected'
        return
    }

    dynamicStatus.value = 'connecting'
    dynamicError.value = ''

    try {
        const socket = new WebSocket(url)
        dynamicWs.value = socket

        socket.onopen = () => {
            dynamicStatus.value = 'connected'
            dynamicError.value = ''
            startPolling()
        }

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.result && Array.isArray(msg.result)) {
                    dynamicServers.value = msg.result
                    if (dynamicError.value) dynamicError.value = ''
                } else if (msg.result && msg.result.error_message) {
                    dynamicError.value = msg.result.error_message
                    stopPolling()
                } else if (msg.error) {
                    console.error('[Dynamic] RPC Error:', msg.error)
                    dynamicError.value = typeof msg.error === 'string' ? msg.error : (msg.error.message || JSON.stringify(msg.error))
                    stopPolling()
                }
            } catch (e) {
                console.error('[Dynamic] Failed to parse message:', event.data)
            }
        }

        socket.onclose = () => {
            dynamicStatus.value = 'disconnected'
            dynamicWs.value = null
            stopPolling()
            if (currentBackend.value) {
                scheduleReconnect()
            }
        }

        socket.onerror = (e) => {
            console.error('[Dynamic] WebSocket Error:', e)
            dynamicStatus.value = 'disconnected'
        }
    } catch (e: any) {
        console.error('[Dynamic] Connection failed:', e)
        dynamicStatus.value = 'disconnected'
        scheduleReconnect()
    }
}

// Watch for backend changes
watch(currentBackend, (newVal, oldVal) => {
    if (newVal?.url !== oldVal?.url || newVal?.token !== oldVal?.token) {
        if (dynamicWs.value) {
            dynamicWs.value.close()
            dynamicWs.value = null
        }
        dynamicStatus.value = 'disconnected'
        if (dynamicReconnectTimeout) clearTimeout(dynamicReconnectTimeout)

        if (newVal) {
            connect()
        }
    }
}, { deep: true })

export function useDynamicData() {
    return {
        status: dynamicStatus,
        error: dynamicError,
        servers: dynamicServers,
        connect
    }
}
