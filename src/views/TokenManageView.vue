<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBackendStore } from '@/composables/useBackendStore'
import HeaderView from '@/components/HeaderView.vue'
import CreateTokenCard from '@/components/token-manage/CreateTokenCard.vue'
import DeleteTokenCard from '@/components/token-manage/DeleteTokenCard.vue'
import { usePermissionStore } from '@/stores/usePermissionStore'

const { currentBackend } = useBackendStore()
const permissionStore = usePermissionStore()
const { isSuperToken } = storeToRefs(permissionStore)

const backendStatus = computed<'disconnected' | 'connecting' | 'connected'>(() =>
  currentBackend.value?.url ? 'connected' : 'disconnected',
)
</script>

<template>
  <div class="min-h-screen">
    <div class="container mx-auto p-6 space-y-6">
      <HeaderView :status="backendStatus" />
      <div class="grid gap-6" :class="isSuperToken ? 'xl:grid-cols-2' : 'xl:grid-cols-1'">
        <CreateTokenCard v-if="isSuperToken" />
        <DeleteTokenCard />
      </div>
    </div>
  </div>
</template>
