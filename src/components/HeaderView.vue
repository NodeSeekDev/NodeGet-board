<script setup lang="ts">
import { ref, onMounted, inject, type Ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Server as ServerIcon, Sparkles, Circle } from 'lucide-vue-next'

defineProps<{
  status: 'disconnected' | 'connecting' | 'connected'
}>()

const isDark = ref(false)
const background = inject<Ref<'default' | 'flickering'>>('background')
const setBackground = inject<(val: 'default' | 'flickering') => void>('setBackground')
const openBackendSwitcher = inject<() => void>('openBackendSwitcher')

const toggleTheme = () => {
    isDark.value = !isDark.value
    if (isDark.value) {
        document.documentElement.classList.add('dark')
        document.cookie = "theme=dark; path=/; max-age=31536000" // 1 year
    } else {
        document.documentElement.classList.remove('dark')
        document.cookie = "theme=light; path=/; max-age=31536000" // 1 year
    }
}

onMounted(() => {
  const themeCookie = document.cookie.split('; ').find(row => row.startsWith('theme='))?.split('=')[1]
  if (themeCookie === 'dark') {
      isDark.value = true
      document.documentElement.classList.add('dark')
  } else {
      isDark.value = false
      document.documentElement.classList.remove('dark')
  }
})
</script>

<template>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-bold tracking-tight animate-pulse">NodeGet</h1>
      </div>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        

        <Button variant="ghost" size="icon" @click="setBackground?.(background === 'default' ? 'flickering' : 'default')" title="Toggle background">
            <Circle v-if="background === 'default'" class="h-4 w-4" />  
            <Sparkles v-else class="h-4 w-4" />
            <span class="sr-only">Toggle background</span>
        </Button>

        <Button variant="ghost" size="icon" @click="toggleTheme">
            <Moon v-if="!isDark" class="h-[1.2rem] w-[1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Sun v-else class="h-[1.2rem] w-[1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span class="sr-only">Toggle theme</span>
        </Button>
        <Button variant="ghost" size="icon" @click="openBackendSwitcher?.()">
            <ServerIcon class="h-4 w-4" />
            <span class="sr-only">Switch backend</span>
        </Button>
        <Badge :variant="status === 'connected' ? 'default' : (status === 'connecting' ? 'secondary' : 'destructive')">
          {{ status === 'connected' ? 'Online' : (status === 'connecting' ? 'Connecting...' : 'Offline') }}
        </Badge>
      </div>
    </div>
</template>
