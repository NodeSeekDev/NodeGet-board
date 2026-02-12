<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, Copy, KeyRound, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useBackendStore } from '@/composables/useBackendStore'
import HeaderView from '@/components/HeaderView.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePermissionStore } from '@/stores/usePermissionStore'
import { wsRpcCallWithFallback } from '@/composables/useWsRpc'

type ToastState = {
  type: 'success' | 'error'
  title: string
  message: string
}

type ScopeMode = 'global' | 'agent'

const STATIC_FIELDS = ['cpu', 'system', 'gpu'] as const
const DYNAMIC_FIELDS = ['cpu', 'ram', 'load', 'system', 'disk', 'network', 'gpu'] as const
const TASK_TYPES = ['ping', 'tcp_ping', 'http_ping', 'web_shell', 'execute', 'ip'] as const

const { currentBackend } = useBackendStore()

const backendStatus = computed<'disconnected' | 'connecting' | 'connected'>(() =>
  currentBackend.value?.url ? 'connected' : 'disconnected',
)
const backendUrl = computed(() => currentBackend.value?.url ?? '')

const scopeMode = ref<ScopeMode>('global')
const agentUuidsText = ref('')

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
const metadataRead = ref(false)
const metadataWrite = ref(false)
const crontabRead = ref(false)
const crontabWrite = ref(false)
const crontabDelete = ref(false)

const createLoading = ref(false)
const createToast = ref<ToastState | null>(null)
const createdCredential = ref<{ key: string; secret: string } | null>(null)

const deleteToken = ref('')
const deleteTargetTokenKey = ref('')
const deleteLoading = ref(false)
const deleteToast = ref<ToastState | null>(null)

const permissionStore = usePermissionStore()
const { isSuperToken, tokenInfo } = storeToRefs(permissionStore)
const currentTokenKey = computed(() => tokenInfo.value?.token_key?.trim() || '')

const toggleList = (list: string[], val: string) => {
  const idx = list.indexOf(val)
  if (idx >= 0) {
    list.splice(idx, 1)
    return
  }
  list.push(val)
}

const parseTimestamp = (val: string) => {
  if (!val.trim()) return null
  const ms = new Date(val).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

const isLikelyParamShapeError = (msg: string) =>
  /invalid\s*params|unknown field|missing field|invalid type|expected/i.test(msg)

const rpcCallWithFallback = async <T = any>(
  url: string,
  method: string,
  candidates: unknown[],
): Promise<T> => {
  return wsRpcCallWithFallback<T>(url, method, candidates, {
    shouldRetry: (error, idx, total) => idx < total - 1 && isLikelyParamShapeError(error.message),
  })
}

const buildPermissions = () => {
  const permissions: Record<string, unknown>[] = []

  if (staticWrite.value) permissions.push({ static_monitoring: 'write' })
  for (const field of staticReads.value) permissions.push({ static_monitoring: { read: field } })

  if (dynamicWrite.value) permissions.push({ dynamic_monitoring: 'write' })
  for (const field of dynamicReads.value) permissions.push({ dynamic_monitoring: { read: field } })

  if (taskListen.value) permissions.push({ task: 'listen' })
  for (const taskType of taskCreate.value) permissions.push({ task: { create: taskType } })
  for (const taskType of taskRead.value) permissions.push({ task: { read: taskType } })
  for (const taskType of taskWrite.value) permissions.push({ task: { write: taskType } })

  if (metadataRead.value) permissions.push({ metadata: 'read' })
  if (metadataWrite.value) permissions.push({ metadata: 'write' })

  if (crontabRead.value) permissions.push({ crontab: 'read' })
  if (crontabWrite.value) permissions.push({ crontab: 'write' })
  if (crontabDelete.value) permissions.push({ crontab: 'delete' })

  return permissions
}

const selectedPermissionCount = computed(() => buildPermissions().length)

const scopePreview = computed(() => {
  if (scopeMode.value === 'global') return ['global']
  return agentUuidsText.value
    .split(/[\n,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((agentUuid) => ({ agent_uuid: agentUuid }))
})

const tokenLimitPreview = computed(() => [
  {
    scopes: scopePreview.value,
    permissions: buildPermissions(),
  },
])

const createdTokenText = computed(() => {
  if (!createdCredential.value) return ''
  return `${createdCredential.value.key}:${createdCredential.value.secret}`
})

const handleCreateToken = async () => {
  createToast.value = null
  createdCredential.value = null

  const url = backendUrl.value
  if (!url) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'No backend is selected. Configure one from the top-right backend switcher.',
    }
    return
  }

  const creatorToken = currentBackend.value?.token?.trim() || ''
  if (!creatorToken) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'Current backend token is empty. Select a backend with a valid token first.',
    }
    return
  }

  const userVal = username.value.trim()
  const passVal = password.value
  if ((userVal && !passVal) || (!userVal && passVal)) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'username and password must be provided together or omitted together.',
    }
    return
  }

  const fromMs = parseTimestamp(timestampFrom.value)
  if (Number.isNaN(fromMs)) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'timestamp_from is not a valid datetime.',
    }
    return
  }

  const toMs = parseTimestamp(timestampTo.value)
  if (Number.isNaN(toMs)) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'timestamp_to is not a valid datetime.',
    }
    return
  }

  if (fromMs !== null && toMs !== null && fromMs > toMs) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'timestamp_from cannot be greater than timestamp_to.',
    }
    return
  }

  const scopes = scopePreview.value
  if (scopeMode.value === 'agent' && scopes.length === 0) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'Scope is set to agent_uuid but no agent UUID is provided.',
    }
    return
  }

  const permissions = buildPermissions()
  if (permissions.length === 0) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: 'At least one permission is required.',
    }
    return
  }

  const tokenCreation: Record<string, unknown> = {
    username: userVal || null,
    password: passVal || null,
    timestamp_from: fromMs,
    timestamp_to: toMs,
    version: 1,
    token_limit: [{ scopes, permissions }],
  }

  const payloadObj = {
    father_token: creatorToken,
    token_creation: tokenCreation,
  }

  createLoading.value = true
  try {
    const result = await rpcCallWithFallback<{ key?: string; secret?: string }>(url, 'token_create', [
      payloadObj,
      [payloadObj],
      [creatorToken, tokenCreation],
    ])

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
  } catch (e: any) {
    createToast.value = {
      type: 'error',
      title: 'Creation Failed',
      message: e?.message || 'Unknown error',
    }
  } finally {
    createLoading.value = false
  }
}

const handleDeleteToken = async () => {
  deleteToast.value = null

  const url = backendUrl.value
  if (!url) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'No backend is selected. Configure one from the top-right backend switcher.',
    }
    return
  }

  const token = deleteToken.value.trim()
  if (!token) {
    deleteToast.value = { type: 'error', title: 'Delete Failed', message: 'token is required.' }
    return
  }

  const targetKey = deleteTargetTokenKey.value.split(':')[0]?.trim() || '' // in case user pastes key:secret

  if (deleteTargetTokenKey.value.includes(':')) {
    deleteTargetTokenKey.value = targetKey
  }

  if (!isSuperToken.value && targetKey) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'Only super token can delete other tokens. Leave target_token_key empty to delete self.',
    }
    return
  }
  if (isSuperToken.value && !targetKey) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'target_token_key is required for super token deletion of another token.',
    }
    return
  }
  if (isSuperToken.value && currentTokenKey.value && targetKey === currentTokenKey.value) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'Super token can only delete non-self token here.',
    }
    return
  }

  const payloadObj: Record<string, unknown> = { token }
  if (isSuperToken.value && targetKey) payloadObj.target_token_key = targetKey

  deleteLoading.value = true
  try {
    const fallbackParams = isSuperToken.value && targetKey ? [token, targetKey] : [token]
    const res = await rpcCallWithFallback(url, 'token_delete', [payloadObj, [payloadObj], fallbackParams])
    if (res.success !== true) {
      throw new Error(res?.message || 'Token deletion failed without error message.')
    }
    deleteToast.value = {
      type: 'success',
      title: 'Delete Requested',
      message: isSuperToken.value && targetKey
        ? `Token with key ${targetKey} has been deleted.`
        : 'Token has been deleted.',
    }
  } catch (e: any) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: e?.message || 'Unknown error',
    }
  } finally {
    deleteLoading.value = false
  }
}

const copyText = async (text: string) => {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

watch(
  () => currentBackend.value?.token,
  (next, prev) => {
    if (!deleteToken.value || deleteToken.value === prev) deleteToken.value = next || ''
  },
  { immediate: true },
)

watch(isSuperToken, (next) => {
  if (!next) deleteTargetTokenKey.value = ''
})
</script>

<template>
  <div class="min-h-screen">
    <div class="container mx-auto p-6 space-y-6">
      <HeaderView :status="backendStatus" />

      <div class="flex items-center justify-between gap-4">
        <Button variant="outline" as-child>
          <router-link to="/" class="inline-flex items-center gap-2">
            <ArrowLeft class="h-4 w-4" />
            Back to Home
          </router-link>
        </Button>
      </div>

      <div class="grid gap-6" :class="isSuperToken ? 'xl:grid-cols-2' : 'xl:grid-cols-1'">
        <Card v-if="isSuperToken">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <KeyRound class="h-5 w-5" />
              Create Token
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-3">
              <Label>Scope</Label>
              <div class="flex flex-wrap gap-2">
                <Button
                  :variant="scopeMode === 'global' ? 'default' : 'outline'"
                  size="sm"
                  @click="scopeMode = 'global'"
                >
                  global
                </Button>
                <Button
                  :variant="scopeMode === 'agent' ? 'default' : 'outline'"
                  size="sm"
                  @click="scopeMode = 'agent'"
                >
                  agent_uuid
                </Button>
              </div>
              <textarea
                v-if="scopeMode === 'agent'"
                v-model="agentUuidsText"
                class="flex min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder="One UUID per line, or split by comma/space."
              />
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Permissions</Label>
                <Badge variant="secondary">{{ selectedPermissionCount }} selected</Badge>
              </div>

              <details class="rounded-md border p-3" open>
                <summary class="cursor-pointer select-none text-sm font-medium">static_monitoring</summary>
                <div class="mt-3 space-y-2">
                  <div class="flex flex-wrap gap-2">
                    <Button
                      :variant="staticWrite ? 'default' : 'outline'"
                      size="sm"
                      @click="staticWrite = !staticWrite"
                    >
                      write
                    </Button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Button
                      v-for="field in STATIC_FIELDS"
                      :key="`sm-read-${field}`"
                      :variant="staticReads.includes(field) ? 'default' : 'outline'"
                      size="sm"
                      @click="toggleList(staticReads, field)"
                    >
                      read:{{ field }}
                    </Button>
                  </div>
                </div>
              </details>

              <details class="rounded-md border p-3">
                <summary class="cursor-pointer select-none text-sm font-medium">dynamic_monitoring</summary>
                <div class="mt-3 space-y-2">
                  <div class="flex flex-wrap gap-2">
                    <Button
                      :variant="dynamicWrite ? 'default' : 'outline'"
                      size="sm"
                      @click="dynamicWrite = !dynamicWrite"
                    >
                      write
                    </Button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Button
                      v-for="field in DYNAMIC_FIELDS"
                      :key="`dm-read-${field}`"
                      :variant="dynamicReads.includes(field) ? 'default' : 'outline'"
                      size="sm"
                      @click="toggleList(dynamicReads, field)"
                    >
                      read:{{ field }}
                    </Button>
                  </div>
                </div>
              </details>

              <details class="rounded-md border p-3">
                <summary class="cursor-pointer select-none text-sm font-medium">task</summary>
                <div class="mt-3 space-y-3">
                  <div class="flex flex-wrap gap-2">
                    <Button
                      :variant="taskListen ? 'default' : 'outline'"
                      size="sm"
                      @click="taskListen = !taskListen"
                    >
                      listen
                    </Button>
                  </div>

                  <details class="rounded-md border p-2">
                    <summary class="cursor-pointer select-none text-xs font-medium">create</summary>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <Button
                        v-for="taskType in TASK_TYPES"
                        :key="`task-create-${taskType}`"
                        :variant="taskCreate.includes(taskType) ? 'default' : 'outline'"
                        size="sm"
                        @click="toggleList(taskCreate, taskType)"
                      >
                        {{ taskType }}
                      </Button>
                    </div>
                  </details>

                  <details class="rounded-md border p-2">
                    <summary class="cursor-pointer select-none text-xs font-medium">read</summary>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <Button
                        v-for="taskType in TASK_TYPES"
                        :key="`task-read-${taskType}`"
                        :variant="taskRead.includes(taskType) ? 'default' : 'outline'"
                        size="sm"
                        @click="toggleList(taskRead, taskType)"
                      >
                        {{ taskType }}
                      </Button>
                    </div>
                  </details>

                  <details class="rounded-md border p-2">
                    <summary class="cursor-pointer select-none text-xs font-medium">write</summary>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <Button
                        v-for="taskType in TASK_TYPES"
                        :key="`task-write-${taskType}`"
                        :variant="taskWrite.includes(taskType) ? 'default' : 'outline'"
                        size="sm"
                        @click="toggleList(taskWrite, taskType)"
                      >
                        {{ taskType }}
                      </Button>
                    </div>
                  </details>
                </div>
              </details>

              <details class="rounded-md border p-3">
                <summary class="cursor-pointer select-none text-sm font-medium">metadata</summary>
                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    :variant="metadataRead ? 'default' : 'outline'"
                    size="sm"
                    @click="metadataRead = !metadataRead"
                  >
                    read
                  </Button>
                  <Button
                    :variant="metadataWrite ? 'default' : 'outline'"
                    size="sm"
                    @click="metadataWrite = !metadataWrite"
                  >
                    write
                  </Button>
                </div>
              </details>

              <details class="rounded-md border p-3">
                <summary class="cursor-pointer select-none text-sm font-medium">crontab</summary>
                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    :variant="crontabRead ? 'default' : 'outline'"
                    size="sm"
                    @click="crontabRead = !crontabRead"
                  >
                    read
                  </Button>
                  <Button
                    :variant="crontabWrite ? 'default' : 'outline'"
                    size="sm"
                    @click="crontabWrite = !crontabWrite"
                  >
                    write
                  </Button>
                  <Button
                    :variant="crontabDelete ? 'default' : 'outline'"
                    size="sm"
                    @click="crontabDelete = !crontabDelete"
                  >
                    delete
                  </Button>
                </div>
              </details>
            </div>

            <div class="space-y-2">
              <Button variant="outline" size="sm" @click="showOptionalOptions = !showOptionalOptions">
                {{ showOptionalOptions ? 'Hide Optional Fields' : 'Show Optional Fields' }}
              </Button>
            </div>

            <div v-if="showOptionalOptions" class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <Label for="username">username</Label>
                <Input id="username" v-model="username" placeholder="Optional" />
              </div>
              <div class="space-y-2">
                <Label for="password">password</Label>
                <Input id="password" v-model="password" type="password" placeholder="Optional" />
              </div>
              <div class="space-y-2">
                <Label for="timestamp-from">timestamp_from</Label>
                <Input id="timestamp-from" v-model="timestampFrom" type="datetime-local" />
              </div>
              <div class="space-y-2">
                <Label for="timestamp-to">timestamp_to</Label>
                <Input id="timestamp-to" v-model="timestampTo" type="datetime-local" />
              </div>
            </div>

            <div class="space-y-2">
              <Button variant="outline" size="sm" @click="showPayloadPreview = !showPayloadPreview">
                {{ showPayloadPreview ? 'Hide Payload Preview' : 'Show Payload Preview' }}
              </Button>
              <div v-if="showPayloadPreview" class="space-y-3 rounded-md border p-3">
                <div class="text-sm font-medium">token_limit preview</div>
                <pre class="text-xs leading-5 overflow-x-auto">{{
                  JSON.stringify(tokenLimitPreview, null, 2)
                }}</pre>
              </div>
            </div>

            <Button class="w-full" :disabled="createLoading" @click="handleCreateToken">
              <span v-if="createLoading">Creating...</span>
              <span v-else>Create Token</span>
            </Button>

            <Alert v-if="createToast" :variant="createToast.type === 'success' ? 'default' : 'destructive'">
              <ShieldCheck v-if="createToast.type === 'success'" class="h-4 w-4" />
              <ShieldAlert v-else class="h-4 w-4" />
              <AlertTitle>{{ createToast.title }}</AlertTitle>
              <AlertDescription>{{ createToast.message }}</AlertDescription>
            </Alert>

            <div v-if="createdCredential" class="rounded-md border p-3 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <Badge variant="secondary">Result</Badge>
                <Button variant="outline" size="sm" @click="copyText(createdTokenText)">
                  <Copy class="h-3.5 w-3.5 mr-1" />
                  Copy key:secret
                </Button>
              </div>
              <div class="text-xs font-mono break-all">key: {{ createdCredential.key }}</div>
              <div class="text-xs font-mono break-all">secret: {{ createdCredential.secret }}</div>
              <div class="text-xs font-mono break-all">token: {{ createdTokenText }}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Trash2 class="h-5 w-5" />
              Delete Token
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label for="delete-token">token</Label>
              <Input id="delete-token" v-model="deleteToken" placeholder="Token performing this deletion" />
            </div>
            <div class="space-y-2">
              <Label for="delete-target-token-key">
                {{
                  isSuperToken
                    ? 'target_token_key (required, must be non-self)'
                    : 'target_token_key (disabled for non-super token)'
                }}
              </Label>
              <Input
                id="delete-target-token-key"
                v-model="deleteTargetTokenKey"
                :disabled="!isSuperToken"
                :placeholder="
                  isSuperToken
                    ? 'Provide another token_key to delete'
                    : 'Non-super token can only self-delete'
                "
              />
            </div>

            <Button class="w-full" variant="destructive" :disabled="deleteLoading" @click="handleDeleteToken">
              <span v-if="deleteLoading">Deleting...</span>
              <span v-else>Delete Token</span>
            </Button>

            <Alert v-if="deleteToast" :variant="deleteToast.type === 'success' ? 'default' : 'destructive'">
              <ShieldCheck v-if="deleteToast.type === 'success'" class="h-4 w-4" />
              <ShieldAlert v-else class="h-4 w-4" />
              <AlertTitle>{{ deleteToast.title }}</AlertTitle>
              <AlertDescription>{{ deleteToast.message }}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
