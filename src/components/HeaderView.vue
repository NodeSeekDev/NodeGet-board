<script setup lang="ts">
import { ref, onMounted, inject, type Ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Moon, Sun } from 'lucide-vue-next'

defineProps<{
  status: 'disconnected' | 'connecting' | 'connected'
}>()

const isDark = ref(false)
const background = inject<Ref<'default' | 'flickering'>>('background')
const setBackground = inject<(val: 'default' | 'flickering') => void>('setBackground')

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
        
        <Select :model-value="background" @update:model-value="(v) => setBackground?.(v as 'default' | 'flickering')">
          <SelectTrigger class="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Background" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="flickering">Flickering</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" @click="toggleTheme">
            <Moon v-if="!isDark" class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Sun v-else class="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span class="sr-only">Toggle theme</span>
        </Button>
        <Badge :variant="status === 'connected' ? 'default' : (status === 'connecting' ? 'secondary' : 'destructive')">
          {{ status === 'connected' ? 'Online' : (status === 'connecting' ? 'Connecting...' : 'Offline') }}
        </Badge>
      </div>
    </div>
</template>
