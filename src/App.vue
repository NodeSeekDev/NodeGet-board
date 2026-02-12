<script setup lang="ts">
import { RouterView } from 'vue-router'
import FlickeringGrid from '@/components/ui/flickering-grid/FlickeringGrid.vue'
import { ref, provide, onMounted, watch } from 'vue'
import BackendSwitcher from '@/components/BackendSwitcher.vue'
import { useBackendStore } from '@/composables/useBackendStore'
import { usePermissionStore } from '@/stores/usePermissionStore'

const background = ref<'default' | 'flickering'>('default')

const setBackground = (val: 'default' | 'flickering') => {
  background.value = val
  document.cookie = `background=${val}; path=/; max-age=31536000` // 1 year
}

provide('background', background)
provide('setBackground', setBackground)

// Backend Switcher Logic
const isBackendSwitcherOpen = ref(false)
const openBackendSwitcher = () => {
    isBackendSwitcherOpen.value = true
}
provide('openBackendSwitcher', openBackendSwitcher)

const { backends, currentBackend } = useBackendStore()
const permissionStore = usePermissionStore()

onMounted(() => {
  const bgCookie = document.cookie.split('; ').find(row => row.startsWith('background='))?.split('=')[1]
  if (bgCookie === 'flickering') {
      background.value = 'flickering'
  }

  // Check if we need to force open backend switcher
  if (!import.meta.env.DEV && backends.value.length === 0) {
      isBackendSwitcherOpen.value = true
  }
})

watch(
  currentBackend,
  (backend) => {
    permissionStore.refreshByBackend(backend)
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div class="fixed inset-0 z-[-1]" v-if="background === 'flickering'">
    <FlickeringGrid
      class="relative inset-0 z-0 [mask-image:radial-gradient(200px_circle_at_50%_25%,white,transparent)] md:[mask-image:radial-gradient(400px_circle_at_50%_25%,white,transparent)]"
      :square-size="4"
      :grid-gap="6"
      color="#6B7280"
      :max-opacity="0.5"
      :flicker-chance="0.1"
    />
  </div>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <BackendSwitcher v-model:open="isBackendSwitcherOpen" />
</template>
<style scoped></style>
