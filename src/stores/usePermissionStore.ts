import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Backend } from '@/composables/useBackendStore'

type PermissionValue = string | Record<string, unknown>

interface PermissionEntry {
  [resource: string]: PermissionValue
}

type ScopeEntry =
  | 'global'
  | { global?: null; agent_uuid?: string; kv_namespace?: string }
  | string

interface TokenLimit {
  scopes?: ScopeEntry[]
  permissions?: PermissionEntry[]
}

export interface TokenInfo {
  version?: number
  token_key?: string
  timestamp_from?: number | null
  timestamp_to?: number | null
  username?: string | null
  token_limit?: TokenLimit[]
}

interface NormalizedPermission {
  scope: string
  resource: string
  action: string
  field?: string
}

// Compact lookup key so permission checks are O(1).
const buildPermissionKey = (scope: string, resource: string, action: string, field = '*') =>
  `${scope}|${resource}|${action}|${field}`

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase()

const normalizeScope = (scope: ScopeEntry): string | null => {
  if (scope === 'global') return 'global'
  if (typeof scope === 'string') return scope
  if (!scope || typeof scope !== 'object') return null
  if ('global' in scope) return 'global'
  if (typeof scope.agent_uuid === 'string' && scope.agent_uuid) return `agent_uuid:${scope.agent_uuid}`
  if (typeof scope.kv_namespace === 'string' && scope.kv_namespace) {
    return `kv_namespace:${scope.kv_namespace}`
  }
  return null
}

// Flattens both forms:
// 1) { crontab: "read" }
// 2) { task: { write: "ping" } }
const normalizePermissionEntry = (entry: PermissionEntry): NormalizedPermission[] => {
  const records: NormalizedPermission[] = []

  for (const [resourceRaw, value] of Object.entries(entry)) {
    const resource = normalizeText(resourceRaw)
    if (!resource) continue

    if (typeof value === 'string') {
      const action = normalizeText(value)
      if (action) {
        records.push({ scope: '', resource, action })
      }
      continue
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) continue

    for (const [actionRaw, fieldRaw] of Object.entries(value)) {
      const action = normalizeText(actionRaw)
      if (!action) continue
      records.push({
        scope: '',
        resource,
        action,
        field: normalizeText(fieldRaw),
      })
    }
  }

  return records
}

// One-shot RPC call over WS, used to fetch current token details.
const requestTokenGet = (url: string, params: unknown): Promise<TokenInfo> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const requestId = Date.now()
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('token_get request timeout'))
    }, 8000)

    const cleanup = () => clearTimeout(timeout)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'token_get',
          params,
        }),
      )
    }

    ws.onerror = () => {
      cleanup()
      reject(new Error('token_get websocket error'))
      ws.close()
    }

    ws.onmessage = (event) => {
      let msg: any
      try {
        msg = JSON.parse(event.data)
      } catch {
        cleanup()
        reject(new Error('token_get invalid response'))
        ws.close()
        return
      }

      if (msg?.id !== requestId) return

      if (msg?.error) {
        const message =
          typeof msg.error === 'string'
            ? msg.error
            : [msg.error.message, msg.error.data].filter(Boolean).join(' | ')
        cleanup()
        reject(new Error(message || 'token_get rpc error'))
        ws.close()
        return
      }

      if (msg?.result?.error_message) {
        cleanup()
        reject(new Error(msg.result.error_message))
        ws.close()
        return
      }

      if (!msg?.result || typeof msg.result !== 'object') {
        cleanup()
        reject(new Error('token_get empty result'))
        ws.close()
        return
      }

      cleanup()
      resolve(msg.result as TokenInfo)
      ws.close()
    }
  })
}

export const usePermissionStore = defineStore('permission', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const tokenInfo = ref<TokenInfo | null>(null)
  const currentBackendKey = ref('')
  const permissionIndex = ref(new Set<string>())
  const normalizedPermissions = ref<NormalizedPermission[]>([])
  const isSuperToken = computed(
    () => normalizeText(tokenInfo.value?.username) === 'root',
  )

  const clear = () => {
    status.value = 'idle'
    error.value = ''
    tokenInfo.value = null
    currentBackendKey.value = ''
    permissionIndex.value = new Set<string>()
    normalizedPermissions.value = []
  }

  const rebuildPermissions = (token: TokenInfo | null) => {
    const nextPermissions: NormalizedPermission[] = []
    const nextIndex = new Set<string>()
    const limits = token?.token_limit ?? []

    for (const limit of limits) {
      const scopes = (limit.scopes ?? []).map(normalizeScope).filter((scope): scope is string => Boolean(scope))
      const effectiveScopes = scopes.length > 0 ? scopes : ['global']

      for (const permission of limit.permissions ?? []) {
        const normalized = normalizePermissionEntry(permission)
        for (const row of normalized) {
          for (const scope of effectiveScopes) {
            const rowWithScope: NormalizedPermission = { ...row, scope }
            nextPermissions.push(rowWithScope)
            // Index both wildcard-field and exact-field forms.
            nextIndex.add(buildPermissionKey(scope, row.resource, row.action))
            if (row.field) {
              nextIndex.add(buildPermissionKey(scope, row.resource, row.action, row.field))
            }
          }
        }
      }
    }

    normalizedPermissions.value = nextPermissions
    permissionIndex.value = nextIndex
  }

  const refreshByBackend = async (backend: Backend | null) => {
    if (!backend?.url || !backend?.token) {
      clear()
      return
    }

    const backendKey = `${backend.url}::${backend.token}`
    if (backendKey === currentBackendKey.value && status.value === 'ready') return

    status.value = 'loading'
    error.value = ''
    currentBackendKey.value = backendKey

    try {
      // token_get docs format: params = { token: "..." }
      const result = await requestTokenGet(backend.url, { token: backend.token })

      tokenInfo.value = result
      rebuildPermissions(result)
      status.value = 'ready'
    } catch (e: any) {
      tokenInfo.value = null
      permissionIndex.value = new Set<string>()
      normalizedPermissions.value = []
      status.value = 'error'
      error.value = e?.message || 'Failed to fetch token permissions'
    }
  }

  const hasPermission = (
    resourceRaw: string,
    actionRaw: string,
    options?: { field?: string; scope?: string },
  ) => {
    if (isSuperToken.value) return true

    const resource = normalizeText(resourceRaw)
    const action = normalizeText(actionRaw)
    const field = options?.field ? normalizeText(options.field) : ''
    const scopes = options?.scope
      ? [normalizeText(options.scope)]
      : availableScopes.value.length > 0
        // By default, treat permissions as valid if any scope grants it.
        ? availableScopes.value
        : ['global']

    for (const scope of scopes) {
      if (!scope) continue
      if (field && permissionIndex.value.has(buildPermissionKey(scope, resource, action, field))) {
        return true
      }
      if (permissionIndex.value.has(buildPermissionKey(scope, resource, action))) {
        return true
      }
    }

    return false
  }

  const hasAnyScopePermission = (
    resourceRaw: string,
    actionRaw: string,
    options?: { field?: string },
  ) => {
    if (isSuperToken.value) return true

    const resource = normalizeText(resourceRaw)
    const action = normalizeText(actionRaw)
    const field = options?.field ? normalizeText(options.field) : ''

    for (const key of permissionIndex.value) {
      const [, kResource, kAction, kField] = key.split('|')
      if (kResource !== resource || kAction !== action) continue
      if (!field) return true
      if (kField === field) return true
    }
    return false
  }

  const availableScopes = computed(() => {
    const scopes = new Set<string>()
    for (const row of normalizedPermissions.value) {
      scopes.add(row.scope)
    }
    return [...scopes]
  })

  return {
    status,
    error,
    tokenInfo,
    isSuperToken,
    normalizedPermissions,
    availableScopes,
    refreshByBackend,
    clear,
    hasPermission,
    hasAnyScopePermission,
  }
})
