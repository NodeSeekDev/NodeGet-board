<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ShieldAlert, ShieldCheck, Trash2 } from 'lucide-vue-next'
import { useBackendStore } from '@/composables/useBackendStore'
import { wsRpcCall } from '@/composables/useWsRpc'
import { usePermissionStore } from '@/stores/permission'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ToastState = {
  type: 'success' | 'error'
  title: string
  message: string
}

const { currentBackend } = useBackendStore()
const backendUrl = computed(() => currentBackend.value?.url ?? '')

const permissionStore = usePermissionStore()
const { tokenInfo } = storeToRefs(permissionStore)
const currentTokenKey = computed(() => tokenInfo.value?.token_key?.trim() || '')

const deleteToken = ref('')
const deleteTargetTokenKey = ref('')
const deleteLoading = ref(false)
const deleteToast = ref<ToastState | null>(null)

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

  const targetKey = deleteTargetTokenKey.value.split(':')[0]?.trim() || ''

  if (deleteTargetTokenKey.value.includes(':')) {
    deleteTargetTokenKey.value = targetKey
  }

  if (!targetKey) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'target_token_key is required.',
    }
    return
  }
  if (currentTokenKey.value && targetKey === currentTokenKey.value) {
    deleteToast.value = {
      type: 'error',
      title: 'Delete Failed',
      message: 'Super token can only delete non-self token here.',
    }
    return
  }

  const payloadObj: Record<string, unknown> = {
    token,
    target_token_key: targetKey,
  }

  deleteLoading.value = true
  try {
    const res = await wsRpcCall<{ success?: boolean; message?: string }>(url, 'token_delete', payloadObj)
    if (res.success !== true) {
      throw new Error(res?.message || 'Token deletion failed without error message.')
    }
    deleteToast.value = {
      type: 'success',
      title: 'Delete Requested',
      message: `Token with key ${targetKey} has been deleted.`,
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

watch(
  () => currentBackend.value?.token,
  (next, prev) => {
    if (!deleteToken.value || deleteToken.value === prev) deleteToken.value = next || ''
  },
  { immediate: true },
)

</script>

<template>
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
        <Input id="delete-token" v-model="deleteToken" placeholder="Super token performing this deletion" />
      </div>
      <div class="space-y-2">
        <Label for="delete-target-token-key">target_token_key (required, must be non-self)</Label>
        <Input
          id="delete-target-token-key"
          v-model="deleteTargetTokenKey"
          placeholder="Provide another token_key to delete"
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
</template>
