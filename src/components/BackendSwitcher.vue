<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBackendStore, type Backend } from '@/composables/useBackendStore'
import { Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const { backends, currentBackend, addBackend, removeBackend, selectBackend } = useBackendStore()

// Local state for new backend form
const newName = ref('')
const newUrl = ref('')
const newToken = ref('')
const testResult = ref<{ success: boolean; msg: string; url: string } | null>(null)

const resetForm = () => {
    newName.value = ''
    newUrl.value = ''
    newToken.value = ''
    testResult.value = null
}

const handleAdd = () => {
    if (!newName.value || !newUrl.value || !newToken.value) return
    
    addBackend({
        name: newName.value,
        url: newUrl.value,
        token: newToken.value
    })
    resetForm()
}

const handleRemove = (b: Backend) => {
    removeBackend(b)
}

const handleSelect = (b: Backend) => {
    selectBackend(b)
}


</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Manage Backends</DialogTitle>
        <DialogDescription>
          Add and select WebSocket backends to connect to.
        </DialogDescription>
      </DialogHeader>
      
      <div class="grid gap-4 py-4">
          <!-- List -->
          <div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              <div v-if="backends.length === 0" class="text-sm text-muted-foreground text-center py-4">
                  No backends added. Add one below :D
              </div>
              <div v-for="backend in backends" :key="backend.url" 
                class="flex items-center justify-between p-3 border rounded-md"
                :class="{'border-primary bg-primary/5': currentBackend?.url === backend.url && currentBackend?.token === backend.token}"
              >
                  <div class="flex flex-col flex-1 min-w-0 mr-4">
                      <div class="flex items-center gap-2">
                        <span class="font-medium truncate">{{ backend.name }}</span>
                         <span v-if="currentBackend?.url === backend.url && currentBackend?.token === backend.token" class="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Active</span>
                      </div>
                      <span class="text-xs text-muted-foreground truncate" :title="backend.url">{{ backend.url }}</span>
                  </div>
                  
                  <div class="flex items-center gap-2">
                       <Button v-if="!(currentBackend?.url === backend.url && currentBackend?.token === backend.token)" size="sm" variant="secondary" @click="handleSelect(backend)">Select</Button>
                       <Button size="icon" variant="ghost" :disabled="backend.name === 'Dev'" class="h-8 w-8 text-destructive hover:text-destructive/90" @click="handleRemove(backend)">
                          <Trash2 class="h-4 w-4" />
                       </Button>
                  </div>
              </div>
          </div>


          <!-- Add Form -->
           <div class="grid gap-4 border-t pt-4">
               <span class="text-sm font-medium">Add New Backend</span>
               <div class="grid grid-cols-2 gap-4">
                   <div class="space-y-2">
                       <Label for="name">Name</Label>
                       <Input id="name" v-model="newName" placeholder="My Server" />
                   </div>
                   <div class="space-y-2">
                       <Label for="url">WS URL</Label>
                       <Input id="url" v-model="newUrl" placeholder="ws://example.com:3000" />
                   </div>
               </div>
               <div class="space-y-2">
                    <Label for="token">Token</Label>
                    <Input id="token" v-model="newToken" type="password" placeholder="key:secret username|password" />
               </div>
               <Button @click="handleAdd" :disabled="!newName || !newUrl || !newToken">Add Backend</Button>
           </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
