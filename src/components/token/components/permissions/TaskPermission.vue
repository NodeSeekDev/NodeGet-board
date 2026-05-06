<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";
import { arePermissionEntriesEqual } from "./permissionsState";
import { usePermissionModuleOpen } from "./usePermissionModuleOpen";

const TASK_TYPES = [
  "ping",
  "tcp_ping",
  "http_ping",
  "web_shell",
  "execute",
  "ip",
  "read_config",
  "edit_config",
  "version",
  "http_request",
] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const listen = ref(false);
const createTargets = ref<string[]>([]);
const readTargets = ref<string[]>([]);
const writeTargets = ref<string[]>([]);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const toggle = (list: string[], value: string) => {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
};

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  if (listen.value) result.push({ task: "listen" });
  for (const value of createTargets.value)
    result.push({ task: { create: value } });
  for (const value of readTargets.value) result.push({ task: { read: value } });
  for (const value of writeTargets.value)
    result.push({ task: { write: value } });
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  listen.value = false;
  createTargets.value = [];
  readTargets.value = [];
  writeTargets.value = [];

  for (const entry of entries || []) {
    const value = entry?.task;
    if (value === "listen") {
      listen.value = true;
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    if (
      typeof obj.create === "string" &&
      !createTargets.value.includes(obj.create)
    )
      createTargets.value.push(obj.create);
    if (typeof obj.read === "string" && !readTargets.value.includes(obj.read))
      readTargets.value.push(obj.read);
    if (
      typeof obj.write === "string" &&
      !writeTargets.value.includes(obj.write)
    )
      writeTargets.value.push(obj.write);
  }
};

watch(
  () => props.modelValue,
  (value) => {
    const nextEntries = Array.isArray(value) ? value : [];
    if (arePermissionEntriesEqual(nextEntries, build())) return;

    hydrating.value = true;
    hydrate(nextEntries);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [listen, createTargets, readTargets, writeTargets],
  () => {
    if (hydrating.value) return;
    const nextEntries = build();
    if (arePermissionEntriesEqual(nextEntries, props.modelValue)) return;
    emits("update:modelValue", nextEntries);
  },
  { deep: true },
);
</script>

<template>
  <details class="rounded-md border p-3" :open="isOpen" @toggle="handleToggle">
    <summary class="cursor-pointer select-none text-sm font-medium">
      {{
        t(
          "dashboard.token.permissionsConfig.limitItem.permissionCard.task.title",
        )
      }}
    </summary>
    <div class="mt-3 space-y-3">
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="listen ? 'default' : 'outline'"
          @click="listen = !listen"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.task.listen",
            )
          }}
        </Button>
      </div>

      <div class="space-y-2">
        <div class="text-xs text-muted-foreground">
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.task.create",
            )
          }}
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="type in TASK_TYPES"
            :key="`task-c-${type}`"
            type="button"
            size="sm"
            :variant="createTargets.includes(type) ? 'default' : 'outline'"
            @click="toggle(createTargets, type)"
            >{{ type }}</Button
          >
        </div>
      </div>

      <div class="space-y-2">
        <div class="text-xs text-muted-foreground">
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.task.read",
            )
          }}
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="type in TASK_TYPES"
            :key="`task-r-${type}`"
            type="button"
            size="sm"
            :variant="readTargets.includes(type) ? 'default' : 'outline'"
            @click="toggle(readTargets, type)"
            >{{ type }}</Button
          >
        </div>
      </div>

      <div class="space-y-2">
        <div class="text-xs text-muted-foreground">
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.task.write",
            )
          }}
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="type in TASK_TYPES"
            :key="`task-w-${type}`"
            type="button"
            size="sm"
            :variant="writeTargets.includes(type) ? 'default' : 'outline'"
            @click="toggle(writeTargets, type)"
            >{{ type }}</Button
          >
        </div>
      </div>
    </div>
  </details>
</template>
