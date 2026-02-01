<script setup lang="ts">
import { RouterView } from 'vue-router'
import FlickeringGrid from '@/components/ui/flickering-grid/FlickeringGrid.vue'
import { ref, provide, onMounted } from 'vue'

const background = ref<'default' | 'flickering'>('default')

const setBackground = (val: 'default' | 'flickering') => {
  background.value = val
  document.cookie = `background=${val}; path=/; max-age=31536000` // 1 year
}

provide('background', background)
provide('setBackground', setBackground)

onMounted(() => {
  const bgCookie = document.cookie.split('; ').find(row => row.startsWith('background='))?.split('=')[1]
  if (bgCookie === 'flickering') {
      background.value = 'flickering'
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[-1]" v-if="background === 'flickering'">
      <FlickeringGrid
        class="relative inset-0 z-0 [mask-image:radial-gradient(500px_circle_at_center,white,transparent)]"
        :square-size="4"
        :grid-gap="6"
        color="#6B7280"
        :max-opacity="0.5"
        :flicker-chance="0.1"
      />
  </div>
  <RouterView />
</template>
<style scoped></style>
