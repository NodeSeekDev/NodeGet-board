import { computed, onMounted, ref, watch } from 'vue'
import { useBackendStore } from '@/composables/useBackendStore'
import { wsRpcCall } from '@/composables/useWsRpc'

export type ToastState = {
  type: 'success' | 'error'
  title: string
  message: string
}

export type GeneralScopeMode = 'global' | 'agent'
export type KvScopeMode = 'global' | 'kv_namespace'
export type TemplateType = 'agent' | 'visitor' | 'custom'
export type PermissionEntry = Record<string, unknown>
export type TokenLimitEntry = {
  scopes: Array<string | Record<string, string>>
  permissions: PermissionEntry[]
}
export type CreatedCredential = {
  key: string
  secret: string
}

const STATIC_FIELDS = ['cpu', 'system', 'gpu'] as const
const DYNAMIC_FIELDS = ['cpu', 'ram', 'load', 'system', 'disk', 'network', 'gpu'] as const
const TASK_TYPES = ['ping', 'tcp_ping', 'http_ping', 'web_shell', 'execute', 'ip'] as const

const parseTimestamp = (raw: string) => {
  if (!raw.trim()) return null
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

const parseTextList = (text: string) => {
  return text
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const parseScopeList = (text: string) => {
  return text
    .split(/[\n,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const uniqueList = (list: string[]) => [...new Set(list)]

const extractAgentUuidList = (result: unknown) => {
  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          if (typeof obj.agent_uuid === 'string') return obj.agent_uuid.trim()
          if (typeof obj.uuid === 'string') return obj.uuid.trim()
        }
        return ''
      })
      .filter(Boolean)
  }

  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    for (const key of ['agent_uuid_list', 'agent_uuids', 'uuids', 'list']) {
      if (!Array.isArray(obj[key])) continue
      return (obj[key] as unknown[])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    }
  }

  return []
}

export const useCreateTokenForm = () => {
  const { currentBackend } = useBackendStore()
  const backendUrl = computed(() => currentBackend.value?.url ?? '')

  const generalScopeMode = ref<GeneralScopeMode>('global')
  const kvScopeMode = ref<KvScopeMode>('global')

  const knownAgentUuids = ref<string[]>([])
  const selectedKnownAgentUuids = ref<string[]>([])
  const otherAgentUuidsText = ref('')
  const kvNamespacesText = ref('')
  const listAgentsLoading = ref(false)
  const listAgentsError = ref('')
  const cachedAgentUuidsByBackend = new Map<string, string[]>()
  const inflightAgentLoadByBackend = new Map<string, Promise<void>>()

  const username = ref('')
  const password = ref('')
  const timestampFrom = ref('')
  const timestampTo = ref('')
  const showOptionalOptions = ref(false)
  const showPayloadPreview = ref(false)

  const staticWrite = ref(false)
  const staticReads = ref<string[]>([])
  const dynamicWrite = ref(false)
  const dynamicReads = ref<string[]>([])
  const taskListen = ref(false)
  const taskCreate = ref<string[]>([])
  const taskRead = ref<string[]>([])
  const taskWrite = ref<string[]>([])
  const crontabRead = ref(false)
  const crontabWrite = ref(false)
  const crontabDelete = ref(false)
  const terminalConnect = ref(false)
  const nodegetListAllAgentUuid = ref(false)
  const crontabResultRead = ref(false)
  const crontabResultWrite = ref(false)
  const crontabResultDelete = ref(false)
  const kvListAllKeys = ref(false)
  const kvReadTargetsText = ref('')
  const kvWriteTargetsText = ref('')
  const kvDeleteTargetsText = ref('')

  const createLoading = ref(false)
  const createToast = ref<ToastState | null>(null)
  const createdCredential = ref<CreatedCredential | null>(null)
  const activeTemplate = ref<TemplateType>('custom')
  const applyingTemplate = ref(false)

  const selectedAgentUuids = computed(() => {
    const dedup = new Set<string>()
    for (const uuid of selectedKnownAgentUuids.value) dedup.add(uuid)
    for (const uuid of parseScopeList(otherAgentUuidsText.value)) dedup.add(uuid)
    return [...dedup]
  })

  const selectedKvNamespaces = computed(() => uniqueList(parseScopeList(kvNamespacesText.value)))
  const selectedKvReadTargets = computed(() => uniqueList(parseTextList(kvReadTargetsText.value)))
  const selectedKvWriteTargets = computed(() => uniqueList(parseTextList(kvWriteTargetsText.value)))
  const selectedKvDeleteTargets = computed(() => uniqueList(parseTextList(kvDeleteTargetsText.value)))

  const toggleKnownAgentUuid = (agentUuid: string) => {
    const idx = selectedKnownAgentUuids.value.indexOf(agentUuid)
    if (idx >= 0) {
      selectedKnownAgentUuids.value.splice(idx, 1)
      return
    }
    selectedKnownAgentUuids.value.push(agentUuid)
  }

  const getAgentCacheKey = () => {
    const url = backendUrl.value.trim()
    const token = currentBackend.value?.token?.trim() || ''
    if (!url || !token) return ''
    return `${url}::${token}`
  }

  const loadKnownAgentUuids = async (options: { force?: boolean } = {}) => {
    const url = backendUrl.value
    const token = currentBackend.value?.token?.trim() || ''
    const cacheKey = getAgentCacheKey()
    const selectedSet = new Set(selectedKnownAgentUuids.value)

    listAgentsError.value = ''
    if (!url) return
    if (!token) {
      knownAgentUuids.value = []
      listAgentsError.value = 'Current backend token is empty. Cannot list agents.'
      return
    }

    if (!options.force && cacheKey && cachedAgentUuidsByBackend.has(cacheKey)) {
      knownAgentUuids.value = cachedAgentUuidsByBackend.get(cacheKey) || []
      selectedKnownAgentUuids.value = knownAgentUuids.value.filter((uuid) => selectedSet.has(uuid))
      return
    }

    if (!options.force && cacheKey) {
      const inflight = inflightAgentLoadByBackend.get(cacheKey)
      if (inflight) {
        await inflight
        knownAgentUuids.value = cachedAgentUuidsByBackend.get(cacheKey) || []
        selectedKnownAgentUuids.value = knownAgentUuids.value.filter((uuid) => selectedSet.has(uuid))
        return
      }
    }

    if (!cacheKey || !cachedAgentUuidsByBackend.has(cacheKey)) {
      knownAgentUuids.value = []
    }

    listAgentsLoading.value = true
    const request = (async () => {
      try {
        const result = await wsRpcCall<unknown>(url, 'nodeget-server_list_all_agent_uuid', { token })
        const nextUuids = extractAgentUuidList(result)
        if (cacheKey) {
          cachedAgentUuidsByBackend.set(cacheKey, nextUuids)
        }
        knownAgentUuids.value = nextUuids
        selectedKnownAgentUuids.value = nextUuids.filter((uuid) => selectedSet.has(uuid))
      } catch (error: any) {
        listAgentsError.value = error?.message || 'Failed to load agent list'
      } finally {
        if (cacheKey) {
          inflightAgentLoadByBackend.delete(cacheKey)
        }
        listAgentsLoading.value = false
      }
    })()

    if (cacheKey) {
      inflightAgentLoadByBackend.set(cacheKey, request)
    }

    await request
  }

  const setGeneralScopeMode = async (
    mode: GeneralScopeMode,
    options: { awaitAgentLoad?: boolean } = {},
  ) => {
    if (generalScopeMode.value === mode) return
    generalScopeMode.value = mode

    if (mode === 'global') {
      selectedKnownAgentUuids.value = []
      otherAgentUuidsText.value = ''
      return
    }

    if (options.awaitAgentLoad) {
      await loadKnownAgentUuids()
      return
    }
    void loadKnownAgentUuids()
  }

  const setKvScopeMode = (mode: KvScopeMode) => {
    if (kvScopeMode.value === mode) return
    kvScopeMode.value = mode
    if (mode === 'global') {
      kvNamespacesText.value = ''
    }
  }

  const generalPermissions = computed<PermissionEntry[]>(() => {
    const permissions: PermissionEntry[] = []

    if (staticWrite.value) permissions.push({ static_monitoring: 'write' })
    for (const field of staticReads.value) permissions.push({ static_monitoring: { read: field } })

    if (dynamicWrite.value) permissions.push({ dynamic_monitoring: 'write' })
    for (const field of dynamicReads.value) permissions.push({ dynamic_monitoring: { read: field } })

    if (taskListen.value) permissions.push({ task: 'listen' })
    for (const taskType of taskCreate.value) permissions.push({ task: { create: taskType } })
    for (const taskType of taskRead.value) permissions.push({ task: { read: taskType } })
    for (const taskType of taskWrite.value) permissions.push({ task: { write: taskType } })

    if (crontabRead.value) permissions.push({ crontab: 'read' })
    if (crontabWrite.value) permissions.push({ crontab: 'write' })
    if (crontabDelete.value) permissions.push({ crontab: 'delete' })

    if (terminalConnect.value) permissions.push({ terminal: 'connect' })
    if (nodegetListAllAgentUuid.value) permissions.push({ nodeget: 'list_all_agent_uuid' })

    if (crontabResultRead.value) permissions.push({ crontab_result: 'read' })
    if (crontabResultWrite.value) permissions.push({ crontab_result: 'write' })
    if (crontabResultDelete.value) permissions.push({ crontab_result: 'delete' })

    return permissions
  })

  const kvPermissions = computed<PermissionEntry[]>(() => {
    const permissions: PermissionEntry[] = []

    if (kvListAllKeys.value) permissions.push({ kv: 'list_all_keys' })
    for (const target of selectedKvReadTargets.value) permissions.push({ kv: { read: target } })
    for (const target of selectedKvWriteTargets.value) permissions.push({ kv: { write: target } })
    for (const target of selectedKvDeleteTargets.value) permissions.push({ kv: { delete: target } })

    return permissions
  })

  const selectedPermissionCount = computed(() => generalPermissions.value.length + kvPermissions.value.length)

  const generalScopes = computed<TokenLimitEntry['scopes']>(() => {
    if (generalScopeMode.value === 'global') return ['global']
    return selectedAgentUuids.value.map((agentUuid) => ({ agent_uuid: agentUuid }))
  })

  const kvScopes = computed<TokenLimitEntry['scopes']>(() => {
    if (kvScopeMode.value === 'global') return ['global']
    return selectedKvNamespaces.value.map((kvNamespace) => ({ kv_namespace: kvNamespace }))
  })

  const generalLimitPreview = computed<TokenLimitEntry | null>(() => {
    if (generalPermissions.value.length === 0) return null
    return {
      scopes: generalScopes.value,
      permissions: generalPermissions.value,
    }
  })

  const kvLimitPreview = computed<TokenLimitEntry | null>(() => {
    if (kvPermissions.value.length === 0) return null
    return {
      scopes: kvScopes.value,
      permissions: kvPermissions.value,
    }
  })

  const tokenLimitPreview = computed<TokenLimitEntry[]>(() => {
    const limits: TokenLimitEntry[] = []
    if (generalLimitPreview.value) limits.push(generalLimitPreview.value)
    if (kvLimitPreview.value) limits.push(kvLimitPreview.value)
    return limits
  })

  const hasGeneralLimit = computed(() => Boolean(generalLimitPreview.value))
  const hasKvLimit = computed(() => Boolean(kvLimitPreview.value))
  const nonKvPermissionCount = computed(() => generalPermissions.value.length)
  const kvPermissionCount = computed(() => kvPermissions.value.length)

  const hasInvalidGeneralScope = computed(() => {
    if (!hasGeneralLimit.value) return false
    if (generalScopeMode.value !== 'agent') return false
    return generalScopes.value.length === 0
  })

  const hasInvalidKvScope = computed(() => {
    if (!hasKvLimit.value) return false
    if (kvScopeMode.value !== 'kv_namespace') return false
    return kvScopes.value.length === 0
  })

  const tokenLimitErrorMessage = computed(() => {
    if (!hasGeneralLimit.value && !hasKvLimit.value) {
      return 'At least one permission is required.'
    }
    if (hasInvalidGeneralScope.value) {
      return 'Non-KV scope is agent_uuid, but no agent UUID is selected.'
    }
    if (hasInvalidKvScope.value) {
      return 'KV scope is kv_namespace, but no namespace is selected.'
    }
    if (tokenLimitPreview.value.length === 0) {
      return 'token_limit is empty.'
    }
    return ''
  })

  const creatorToken = computed(() => currentBackend.value?.token?.trim() || '')
  const usernameValue = computed(() => username.value.trim())
  const timestampFromValue = computed(() => parseTimestamp(timestampFrom.value))
  const timestampToValue = computed(() => parseTimestamp(timestampTo.value))

  const formValidationError = computed(() => {
    if (!backendUrl.value) {
      return 'No backend is selected. Configure one from the top-right backend switcher.'
    }
    if (!creatorToken.value) {
      return 'Current backend token is empty. Select a backend with a valid token first.'
    }

    const userVal = usernameValue.value
    const passVal = password.value
    if ((userVal && !passVal) || (!userVal && passVal)) {
      return 'username and password must be provided together or omitted together.'
    }

    if (Number.isNaN(timestampFromValue.value)) {
      return 'timestamp_from is not a valid datetime.'
    }
    if (Number.isNaN(timestampToValue.value)) {
      return 'timestamp_to is not a valid datetime.'
    }

    if (
      timestampFromValue.value !== null
      && timestampToValue.value !== null
      && timestampFromValue.value > timestampToValue.value
    ) {
      return 'timestamp_from cannot be greater than timestamp_to.'
    }

    return tokenLimitErrorMessage.value
  })

  const canCreateToken = computed(() => !createLoading.value && !formValidationError.value)

  const createdTokenText = computed(() => {
    if (!createdCredential.value) return ''
    return `${createdCredential.value.key}:${createdCredential.value.secret}`
  })

  const resetPermissions = () => {
    staticWrite.value = false
    staticReads.value = []
    dynamicWrite.value = false
    dynamicReads.value = []
    taskListen.value = false
    taskCreate.value = []
    taskRead.value = []
    taskWrite.value = []
    crontabRead.value = false
    crontabWrite.value = false
    crontabDelete.value = false
    terminalConnect.value = false
    nodegetListAllAgentUuid.value = false
    crontabResultRead.value = false
    crontabResultWrite.value = false
    crontabResultDelete.value = false
    kvListAllKeys.value = false
    kvReadTargetsText.value = ''
    kvWriteTargetsText.value = ''
    kvDeleteTargetsText.value = ''
    activeTemplate.value = 'custom'
  }

  const withTemplateApplyGuard = async (runner: () => void | Promise<void>) => {
    applyingTemplate.value = true
    try {
      await runner()
    } finally {
      applyingTemplate.value = false
    }
  }

  const applyAgentTemplate = async () => {
    await withTemplateApplyGuard(async () => {
      resetPermissions()
      await setGeneralScopeMode('agent', { awaitAgentLoad: false })
      setKvScopeMode('global')

      staticWrite.value = true
      dynamicWrite.value = true
      taskListen.value = true
      taskWrite.value = [...TASK_TYPES]
      activeTemplate.value = 'agent'
    })
  }

  const applyVisitorTemplate = async () => {
    await withTemplateApplyGuard(async () => {
      resetPermissions()
      await setGeneralScopeMode('agent', { awaitAgentLoad: false })
      setKvScopeMode('global')

      staticReads.value = ['cpu', 'system']
      dynamicReads.value = ['cpu', 'system']
      activeTemplate.value = 'visitor'
    })
  }

  const setCustomTemplate = () => {
    activeTemplate.value = 'custom'
  }

  const handleCreateToken = async () => {
    createToast.value = null
    createdCredential.value = null

    const validationError = formValidationError.value
    if (validationError) {
      createToast.value = {
        type: 'error',
        title: 'Creation Failed',
        message: validationError,
      }
      return
    }

    const url = backendUrl.value
    const token = creatorToken.value
    const userVal = usernameValue.value
    const fromMs = timestampFromValue.value
    const toMs = timestampToValue.value

    const tokenCreation: Record<string, unknown> = {
      username: userVal || null,
      password: password.value || null,
      timestamp_from: fromMs,
      timestamp_to: toMs,
      version: 1,
      token_limit: tokenLimitPreview.value,
    }

    const payloadObj = {
      father_token: token,
      token_creation: tokenCreation,
    }

    createLoading.value = true
    try {
      const result = await wsRpcCall<{ key?: string; secret?: string }>(url, 'token_create', payloadObj)
      const key = result?.key || ''
      const secret = result?.secret || ''
      if (!key || !secret) {
        throw new Error('Token was created but key/secret is missing in response.')
      }

      createdCredential.value = { key, secret }
      createToast.value = {
        type: 'success',
        title: 'Token Created',
        message: 'Save the generated credential now. Secret is not retrievable later.',
      }
    } catch (error: any) {
      createToast.value = {
        type: 'error',
        title: 'Creation Failed',
        message: error?.message || 'Unknown error',
      }
    } finally {
      createLoading.value = false
    }
  }

  const copyText = async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

  const templatePermissionFingerprint = computed(() => JSON.stringify({
    staticWrite: staticWrite.value,
    staticReads: [...staticReads.value],
    dynamicWrite: dynamicWrite.value,
    dynamicReads: [...dynamicReads.value],
    taskListen: taskListen.value,
    taskCreate: [...taskCreate.value],
    taskRead: [...taskRead.value],
    taskWrite: [...taskWrite.value],
    crontabRead: crontabRead.value,
    crontabWrite: crontabWrite.value,
    crontabDelete: crontabDelete.value,
    terminalConnect: terminalConnect.value,
    nodegetListAllAgentUuid: nodegetListAllAgentUuid.value,
    crontabResultRead: crontabResultRead.value,
    crontabResultWrite: crontabResultWrite.value,
    crontabResultDelete: crontabResultDelete.value,
    kvListAllKeys: kvListAllKeys.value,
    kvReadTargetsText: kvReadTargetsText.value,
    kvWriteTargetsText: kvWriteTargetsText.value,
    kvDeleteTargetsText: kvDeleteTargetsText.value,
  }))

  watch(templatePermissionFingerprint, (_, previous) => {
    if (previous === undefined) return
    if (applyingTemplate.value) return
    if (activeTemplate.value === 'custom') return
    activeTemplate.value = 'custom'
  })

  onMounted(() => {
    if (generalScopeMode.value === 'agent') loadKnownAgentUuids()
  })

  watch([backendUrl, () => currentBackend.value?.token], () => {
    if (generalScopeMode.value === 'agent') loadKnownAgentUuids()
  })

  return {
    STATIC_FIELDS,
    DYNAMIC_FIELDS,
    TASK_TYPES,
    generalScopeMode,
    kvScopeMode,
    knownAgentUuids,
    selectedKnownAgentUuids,
    selectedAgentUuids,
    otherAgentUuidsText,
    kvNamespacesText,
    selectedKvNamespaces,
    listAgentsLoading,
    listAgentsError,
    username,
    password,
    timestampFrom,
    timestampTo,
    showOptionalOptions,
    showPayloadPreview,
    staticWrite,
    staticReads,
    dynamicWrite,
    dynamicReads,
    taskListen,
    taskCreate,
    taskRead,
    taskWrite,
    crontabRead,
    crontabWrite,
    crontabDelete,
    terminalConnect,
    nodegetListAllAgentUuid,
    crontabResultRead,
    crontabResultWrite,
    crontabResultDelete,
    kvListAllKeys,
    kvReadTargetsText,
    kvWriteTargetsText,
    kvDeleteTargetsText,
    createLoading,
    canCreateToken,
    formValidationError,
    createToast,
    createdCredential,
    selectedPermissionCount,
    nonKvPermissionCount,
    kvPermissionCount,
    tokenLimitPreview,
    createdTokenText,
    activeTemplate,
    toggleKnownAgentUuid,
    loadKnownAgentUuids,
    setGeneralScopeMode,
    setKvScopeMode,
    applyAgentTemplate,
    applyVisitorTemplate,
    setCustomTemplate,
    resetPermissions,
    handleCreateToken,
    copyText,
  }
}

export type CreateTokenForm = ReturnType<typeof useCreateTokenForm>
