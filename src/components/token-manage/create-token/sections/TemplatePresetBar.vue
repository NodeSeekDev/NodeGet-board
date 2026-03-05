<script setup lang="ts">
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { CreateTokenForm } from '../useCreateTokenForm'

const props = defineProps<{
  form: CreateTokenForm
}>()

const {
  activeTemplate,
  applyAgentTemplate,
  applyVisitorTemplate,
  setCustomTemplate,
  resetPermissions,
} = props.form
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <Label>Templates</Label>
      <Button v-if="activeTemplate === 'custom'" variant="outline" size="sm" @click="resetPermissions">
        Reset Permissions
      </Button>
    </div>

    <div class="grid gap-2 md:grid-cols-3">
      <Button
        :variant="activeTemplate === 'agent' ? 'default' : 'outline'"
        class="h-auto justify-start py-3 text-left whitespace-normal"
        @click="applyAgentTemplate"
      >
        <span class="flex flex-col items-start">
          <span class="font-medium">Agent</span>
          <span class="text-xs opacity-80 break-words leading-snug">Write monitoring + task write preset</span>
        </span>
      </Button>

      <Button
        :variant="activeTemplate === 'visitor' ? 'default' : 'outline'"
        class="h-auto justify-start py-3 text-left whitespace-normal"
        @click="applyVisitorTemplate"
      >
        <span class="flex flex-col items-start">
          <span class="font-medium">Visitor</span>
          <span class="text-xs opacity-80 break-words leading-snug">Read-only monitoring preset</span>
        </span>
      </Button>

      <Button
        :variant="activeTemplate === 'custom' ? 'default' : 'outline'"
        class="h-auto justify-start py-3 text-left whitespace-normal"
        @click="setCustomTemplate"
      >
        <span class="flex flex-col items-start">
          <span class="font-medium">Custom</span>
          <span class="text-xs opacity-80 break-words leading-snug">Manually adjust all permissions</span>
        </span>
      </Button>
    </div>
  </div>
</template>
