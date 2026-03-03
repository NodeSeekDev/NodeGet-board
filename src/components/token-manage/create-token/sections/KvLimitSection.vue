<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { CreateTokenForm } from '../useCreateTokenForm'

const props = defineProps<{
  form: CreateTokenForm
}>()

const {
  kvScopeMode,
  setKvScopeMode,
  kvNamespacesText,
  selectedKvNamespaces,
  kvPermissionCount,
  kvListAllKeys,
  kvReadTargetsText,
  kvWriteTargetsText,
  kvDeleteTargetsText,
} = props.form
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <Label>KV Limit</Label>
      <Badge variant="secondary">{{ kvPermissionCount }} permissions</Badge>
    </div>

    <details class="rounded-md border p-3" open>
      <summary class="cursor-pointer select-none text-sm font-medium">Scope + permissions</summary>
      <div class="mt-3 space-y-3">
        <div class="space-y-2 rounded-md border p-3">
          <Label>KV Scope</Label>
          <div class="flex flex-wrap items-center gap-2">
            <Button :variant="kvScopeMode === 'global' ? 'default' : 'outline'" size="sm" @click="setKvScopeMode('global')">global</Button>
            <Button :variant="kvScopeMode === 'kv_namespace' ? 'default' : 'outline'" size="sm" @click="setKvScopeMode('kv_namespace')">
              kv_namespace
            </Button>
          </div>
          <div v-if="kvScopeMode === 'kv_namespace'" class="space-y-2">
            <div class="text-xs text-muted-foreground">Selected namespaces: {{ selectedKvNamespaces.length }}</div>
            <Label for="kv-namespaces">KV namespaces</Label>
            <textarea
              id="kv-namespaces"
              v-model="kvNamespacesText"
              class="flex min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="One namespace per line, or split by comma/space."
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button :variant="kvListAllKeys ? 'default' : 'outline'" size="sm" @click="kvListAllKeys = !kvListAllKeys">
            list_all_keys
          </Button>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div class="space-y-2">
            <Label for="kv-read-targets">read targets</Label>
            <textarea
              id="kv-read-targets"
              v-model="kvReadTargetsText"
              class="flex min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="metadata_*"
            />
          </div>
          <div class="space-y-2">
            <Label for="kv-write-targets">write targets</Label>
            <textarea
              id="kv-write-targets"
              v-model="kvWriteTargetsText"
              class="flex min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="runtime_config"
            />
          </div>
          <div class="space-y-2">
            <Label for="kv-delete-targets">delete targets</Label>
            <textarea
              id="kv-delete-targets"
              v-model="kvDeleteTargetsText"
              class="flex min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="temp_*"
            />
          </div>
        </div>

        <p class="text-xs text-muted-foreground">Enter one key pattern per line, or split by comma.</p>
      </div>
    </details>
  </div>
</template>
