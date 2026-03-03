<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { CreateTokenForm } from '../useCreateTokenForm'

const props = defineProps<{
  form: CreateTokenForm
}>()

const toggleList = (list: string[], value: string) => {
  const idx = list.indexOf(value)
  if (idx >= 0) {
    list.splice(idx, 1)
    return
  }
  list.push(value)
}

const {
  STATIC_FIELDS,
  DYNAMIC_FIELDS,
  TASK_TYPES,
  generalScopeMode,
  setGeneralScopeMode,
  listAgentsLoading,
  loadKnownAgentUuids,
  listAgentsError,
  knownAgentUuids,
  selectedKnownAgentUuids,
  selectedAgentUuids,
  toggleKnownAgentUuid,
  otherAgentUuidsText,
  nonKvPermissionCount,
  staticWrite,
  staticReads,
  dynamicWrite,
  dynamicReads,
  taskListen,
  taskCreate,
  taskRead,
  taskWrite,
  crontabRead,
  crontabWrite,
  crontabDelete,
  terminalConnect,
  crontabResultRead,
  crontabResultWrite,
  crontabResultDelete,
  nodegetListAllAgentUuid,
} = props.form
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <Label>Non-KV Limit</Label>
      <Badge variant="secondary">{{ nonKvPermissionCount }} permissions</Badge>
    </div>

    <div class="rounded-md border p-3 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Button :variant="generalScopeMode === 'global' ? 'default' : 'outline'" size="sm" @click="setGeneralScopeMode('global')">
            global
          </Button>
          <Button :variant="generalScopeMode === 'agent' ? 'default' : 'outline'" size="sm" @click="setGeneralScopeMode('agent')">
            agent_uuid
          </Button>
        </div>
        <Button v-if="generalScopeMode === 'agent'" variant="outline" size="sm" :disabled="listAgentsLoading" @click="loadKnownAgentUuids({ force: true })">
          {{ listAgentsLoading ? 'Loading...' : 'Refresh Agents' }}
        </Button>
      </div>

      <div v-if="generalScopeMode === 'agent'" class="space-y-3 rounded-md border p-3">
        <div class="text-xs text-muted-foreground">Selected agent UUIDs: {{ selectedAgentUuids.length }}</div>

        <div v-if="listAgentsError" class="text-sm text-destructive">{{ listAgentsError }}</div>
        <div v-else-if="knownAgentUuids.length === 0" class="text-sm text-muted-foreground">No known agents found on current server.</div>
        <div v-else class="grid gap-2 max-h-48 overflow-auto pr-1">
          <label v-for="agentUuid in knownAgentUuids" :key="`known-agent-${agentUuid}`" class="flex items-center gap-2 text-sm break-all">
            <Checkbox :checked="selectedKnownAgentUuids.includes(agentUuid)" @click.stop="toggleKnownAgentUuid(agentUuid)" />
            <span>{{ agentUuid }}</span>
          </label>
        </div>

        <div class="space-y-2">
          <Label for="other-agent-uuids">Other agent UUIDs</Label>
          <textarea
            id="other-agent-uuids"
            v-model="otherAgentUuidsText"
            class="flex min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            placeholder="Optional. One UUID per line, or split by comma/space."
          />
        </div>
      </div>
    </div>

    <details class="rounded-md border p-3" open>
      <summary class="cursor-pointer select-none text-sm font-medium">static_monitoring</summary>
      <div class="mt-3 space-y-2">
        <div class="flex flex-wrap gap-2">
          <Button :variant="staticWrite ? 'default' : 'outline'" size="sm" @click="staticWrite = !staticWrite">write</Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="field in STATIC_FIELDS"
            :key="`sm-read-${field}`"
            :variant="staticReads.includes(field) ? 'default' : 'outline'"
            size="sm"
            @click="toggleList(staticReads, field)"
          >
            read:{{ field }}
          </Button>
        </div>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">dynamic_monitoring</summary>
      <div class="mt-3 space-y-2">
        <div class="flex flex-wrap gap-2">
          <Button :variant="dynamicWrite ? 'default' : 'outline'" size="sm" @click="dynamicWrite = !dynamicWrite">write</Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="field in DYNAMIC_FIELDS"
            :key="`dm-read-${field}`"
            :variant="dynamicReads.includes(field) ? 'default' : 'outline'"
            size="sm"
            @click="toggleList(dynamicReads, field)"
          >
            read:{{ field }}
          </Button>
        </div>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">task</summary>
      <div class="mt-3 space-y-3">
        <div class="flex flex-wrap gap-2">
          <Button :variant="taskListen ? 'default' : 'outline'" size="sm" @click="taskListen = !taskListen">listen</Button>
        </div>

        <details class="rounded-md border p-2">
          <summary class="cursor-pointer select-none text-xs font-medium">create</summary>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button
              v-for="taskType in TASK_TYPES"
              :key="`task-create-${taskType}`"
              :variant="taskCreate.includes(taskType) ? 'default' : 'outline'"
              size="sm"
              @click="toggleList(taskCreate, taskType)"
            >
              {{ taskType }}
            </Button>
          </div>
        </details>

        <details class="rounded-md border p-2">
          <summary class="cursor-pointer select-none text-xs font-medium">read</summary>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button
              v-for="taskType in TASK_TYPES"
              :key="`task-read-${taskType}`"
              :variant="taskRead.includes(taskType) ? 'default' : 'outline'"
              size="sm"
              @click="toggleList(taskRead, taskType)"
            >
              {{ taskType }}
            </Button>
          </div>
        </details>

        <details class="rounded-md border p-2">
          <summary class="cursor-pointer select-none text-xs font-medium">write</summary>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button
              v-for="taskType in TASK_TYPES"
              :key="`task-write-${taskType}`"
              :variant="taskWrite.includes(taskType) ? 'default' : 'outline'"
              size="sm"
              @click="toggleList(taskWrite, taskType)"
            >
              {{ taskType }}
            </Button>
          </div>
        </details>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">crontab</summary>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button :variant="crontabRead ? 'default' : 'outline'" size="sm" @click="crontabRead = !crontabRead">read</Button>
        <Button :variant="crontabWrite ? 'default' : 'outline'" size="sm" @click="crontabWrite = !crontabWrite">write</Button>
        <Button :variant="crontabDelete ? 'default' : 'outline'" size="sm" @click="crontabDelete = !crontabDelete">delete</Button>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">terminal</summary>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button :variant="terminalConnect ? 'default' : 'outline'" size="sm" @click="terminalConnect = !terminalConnect">
          connect
        </Button>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">crontab_result</summary>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button :variant="crontabResultRead ? 'default' : 'outline'" size="sm" @click="crontabResultRead = !crontabResultRead">read</Button>
        <Button :variant="crontabResultWrite ? 'default' : 'outline'" size="sm" @click="crontabResultWrite = !crontabResultWrite">write</Button>
        <Button :variant="crontabResultDelete ? 'default' : 'outline'" size="sm" @click="crontabResultDelete = !crontabResultDelete">delete</Button>
      </div>
    </details>

    <details class="rounded-md border p-3">
      <summary class="cursor-pointer select-none text-sm font-medium">nodeget</summary>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button :variant="nodegetListAllAgentUuid ? 'default' : 'outline'" size="sm" @click="nodegetListAllAgentUuid = !nodegetListAllAgentUuid">
          list_all_agent_uuid
        </Button>
      </div>
    </details>
  </div>
</template>
