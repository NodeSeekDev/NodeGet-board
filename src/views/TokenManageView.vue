<script setup lang="ts">
import { computed } from 'vue'
import { useBackendStore } from '@/composables/useBackendStore'
import HeaderView from '@/components/HeaderView.vue'
import CreateTokenCard from '@/components/token-manage/CreateTokenCard.vue'
import DeleteTokenCard from '@/components/token-manage/DeleteTokenCard.vue'
const { currentBackend } = useBackendStore()

const backendStatus = computed<'disconnected' | 'connecting' | 'connected'>(() =>
  currentBackend.value?.url ? 'connected' : 'disconnected',
)
</script>

<template>
  <div class="min-h-screen">
    <div class="container mx-auto p-6 space-y-6">
      <HeaderView :status="backendStatus" />
      <div class="grid gap-6 xl:grid-cols-2">
        <CreateTokenCard />
        <DeleteTokenCard />
      </div>
    </div>
  </div>
</template>
