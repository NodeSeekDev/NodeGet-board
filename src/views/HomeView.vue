<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-vue-next'

const error = ref('')

onMounted(() => {
  if (import.meta.env.DEV) {
    const wsUrl = import.meta.env.VITE_BACKEND_WS
    
    if (!wsUrl) {
      error.value = 'VITE_BACKEND_WS not defined'
      console.warn('VITE_BACKEND_WS not defined')
      return
    }

    console.log('Attempting to connect to WebSocket:', wsUrl)
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully')
      error.value = ''
    }

    ws.onerror = (e) => {
      console.error('WebSocket error:', e)
      error.value = `Failed to connect to backend WebSocket at ${wsUrl}. Please check if the server is running.`
    }
  }
})
</script>

<template>
  <div class="container mx-auto p-4">
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription>
        {{ error }}
      </AlertDescription>
    </Alert>

    <h1 class="text-2xl font-bold">Home</h1>
  </div>
</template>

