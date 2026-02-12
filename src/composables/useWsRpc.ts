interface RpcErrorShape {
  message?: unknown
  data?: unknown
}

interface WsRpcMessage {
  id?: unknown
  result?: unknown
  error?: unknown
}

interface WsRpcCallOptions {
  timeoutMs?: number
  requestId?: number
}

interface WsRpcFallbackOptions extends WsRpcCallOptions {
  shouldRetry?: (error: Error, attemptIndex: number, totalAttempts: number) => boolean
}

const formatRpcError = (error: unknown): string => {
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return ''

  const rpcError = error as RpcErrorShape
  const parts = [rpcError.message, rpcError.data].filter(Boolean).map((part) => String(part))
  if (parts.length > 0) return parts.join(' | ')

  try {
    return JSON.stringify(error)
  } catch {
    return ''
  }
}

export const wsRpcCall = <T = unknown>(
  url: string,
  method: string,
  params: unknown,
  options: WsRpcCallOptions = {},
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const requestId = options.requestId ?? Date.now() + Math.floor(Math.random() * 1000)
    const timeoutMs = options.timeoutMs ?? 8000
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error(`${method} request timeout`))
    }, timeoutMs)

    const cleanup = () => clearTimeout(timeout)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method,
          params,
        }),
      )
    }

    ws.onerror = () => {
      cleanup()
      reject(new Error(`${method} websocket error`))
      ws.close()
    }

    ws.onmessage = (event) => {
      let msg: WsRpcMessage
      try {
        msg = JSON.parse(event.data)
      } catch {
        cleanup()
        reject(new Error(`${method} invalid response`))
        ws.close()
        return
      }

      if (msg?.id !== requestId) return

      if (msg?.error) {
        cleanup()
        reject(new Error(formatRpcError(msg.error) || `${method} rpc error`))
        ws.close()
        return
      }

      if (
        msg?.result &&
        typeof msg.result === 'object' &&
        !Array.isArray(msg.result) &&
        'error_message' in msg.result
      ) {
        cleanup()
        reject(new Error(String((msg.result as { error_message?: unknown }).error_message || `${method} rpc error`)))
        ws.close()
        return
      }

      cleanup()
      resolve(msg?.result as T)
      ws.close()
    }
  })
}

export const wsRpcCallWithFallback = async <T = unknown>(
  url: string,
  method: string,
  paramCandidates: unknown[],
  options: WsRpcFallbackOptions = {},
): Promise<T> => {
  let lastError: Error | null = null

  for (let index = 0; index < paramCandidates.length; index += 1) {
    try {
      return await wsRpcCall<T>(url, method, paramCandidates[index], options)
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      lastError = normalizedError
      const isLast = index === paramCandidates.length - 1
      if (isLast) throw normalizedError

      const shouldRetry = options.shouldRetry
        ? options.shouldRetry(normalizedError, index, paramCandidates.length)
        : true
      if (!shouldRetry) throw normalizedError
    }
  }

  throw lastError || new Error(`${method} failed`)
}
