import { ref } from 'vue'

const status = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const error = ref('')
const servers = ref<any[]>([])
const ws = ref<WebSocket | null>(null)
let pollInterval: any = null
let reconnectTimeout: any = null
let nextId = 1

const token = import.meta.env.VITE_BACKEND_TOKEN
const wsUrl = import.meta.env.VITE_BACKEND_WS
const queryFields = ['cpu', 'ram', 'load', 'system', 'disk', 'network', 'gpu']

const scheduleReconnect = () => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
    reconnectTimeout = setTimeout(() => {
        connect()
    }, 3000)
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

const startPolling = () => {
    if (pollInterval) clearInterval(pollInterval)
    sendQuery()
    pollInterval = setInterval(sendQuery, 1000)
}

const stopPolling = () => {
    if (pollInterval) clearInterval(pollInterval)
    pollInterval = null
}

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

export function useServerData() {
    return {
        status,
        error,
        servers,
        connect
    }
}
