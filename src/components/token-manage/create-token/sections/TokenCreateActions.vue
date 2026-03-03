<script setup lang="ts">
import { Copy, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CreateTokenForm } from '../useCreateTokenForm'

const props = defineProps<{
  form: CreateTokenForm
}>()

const {
  canCreateToken,
  formValidationError,
  createLoading,
  handleCreateToken,
  createToast,
  createdCredential,
  createdTokenText,
  copyText,
} = props.form
</script>

<template>
  <div class="space-y-3">
    <Alert v-if="formValidationError" variant="destructive">
      <ShieldAlert class="h-4 w-4" />
      <AlertTitle>Cannot Create Yet</AlertTitle>
      <AlertDescription>{{ formValidationError }}</AlertDescription>
    </Alert>

    <Button class="w-full" :disabled="!canCreateToken" @click="handleCreateToken">
      <span v-if="createLoading">Creating...</span>
      <span v-else>Create Token</span>
    </Button>

    <Alert v-if="createToast" :variant="createToast.type === 'success' ? 'default' : 'destructive'">
      <ShieldCheck v-if="createToast.type === 'success'" class="h-4 w-4" />
      <ShieldAlert v-else class="h-4 w-4" />
      <AlertTitle>{{ createToast.title }}</AlertTitle>
      <AlertDescription>{{ createToast.message }}</AlertDescription>
    </Alert>

    <div v-if="createdCredential" class="rounded-md border p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <Badge variant="secondary">Result</Badge>
        <Button variant="outline" size="sm" @click="copyText(createdTokenText)">
          <Copy class="h-3.5 w-3.5 mr-1" />
          Copy key:secret
        </Button>
      </div>
      <div class="text-xs font-mono break-all">key: {{ createdCredential.key }}</div>
      <div class="text-xs font-mono break-all">secret: {{ createdCredential.secret }}</div>
      <div class="text-xs font-mono break-all">token: {{ createdTokenText }}</div>
    </div>
  </div>
</template>
