<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateTokenForm } from '../useCreateTokenForm'

const props = defineProps<{
  form: CreateTokenForm
}>()

const {
  showOptionalOptions,
  username,
  password,
  timestampFrom,
  timestampTo,
  showPayloadPreview,
  tokenLimitPreview,
} = props.form
</script>

<template>
  <div class="space-y-3">
    <Button variant="outline" size="sm" @click="showOptionalOptions = !showOptionalOptions">
      {{ showOptionalOptions ? 'Hide Optional Fields' : 'Show Optional Fields' }}
    </Button>

    <div v-if="showOptionalOptions" class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label for="username">username</Label>
        <Input id="username" v-model="username" placeholder="Optional" />
      </div>
      <div class="space-y-2">
        <Label for="password">password</Label>
        <Input id="password" v-model="password" type="password" placeholder="Optional" />
      </div>
      <div class="space-y-2">
        <Label for="timestamp-from">timestamp_from</Label>
        <Input id="timestamp-from" v-model="timestampFrom" type="datetime-local" />
      </div>
      <div class="space-y-2">
        <Label for="timestamp-to">timestamp_to</Label>
        <Input id="timestamp-to" v-model="timestampTo" type="datetime-local" />
      </div>
    </div>

    <Button variant="outline" size="sm" @click="showPayloadPreview = !showPayloadPreview">
      {{ showPayloadPreview ? 'Hide Payload Preview' : 'Show Payload Preview' }}
    </Button>
    <div v-if="showPayloadPreview" class="space-y-3 rounded-md border p-3">
      <div class="text-sm font-medium">token_limit preview</div>
      <pre class="text-xs leading-5 overflow-x-auto">{{ JSON.stringify(tokenLimitPreview, null, 2) }}</pre>
    </div>
  </div>
</template>
