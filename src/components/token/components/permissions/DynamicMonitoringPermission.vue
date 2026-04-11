<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";
import { arePermissionEntriesEqual } from "./permissionsState";
import { usePermissionModuleOpen } from "./usePermissionModuleOpen";

const FIELDS = [
  "cpu",
  "ram",
  "load",
  "system",
  "disk",
  "network",
  "gpu",
] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const readTargets = ref<string[]>([]);
const writeEnabled = ref(false);
const deleteEnabled = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const toggleReadTarget = (target: string) => {
  const index = readTargets.value.indexOf(target);
  if (index >= 0) {
    readTargets.value.splice(index, 1);
    return;
  }
  readTargets.value.push(target);
};

const toggleWrite = () => {
  writeEnabled.value = !writeEnabled.value;
};
const toggleDelete = () => {
  deleteEnabled.value = !deleteEnabled.value;
};

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  for (const field of readTargets.value)
    result.push({ dynamic_monitoring: { read: field } });
  if (writeEnabled.value) result.push({ dynamic_monitoring: "write" });
  if (deleteEnabled.value) result.push({ dynamic_monitoring: "delete" });
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  readTargets.value = [];
  writeEnabled.value = false;
  deleteEnabled.value = false;
  for (const entry of entries || []) {
    const value = entry?.dynamic_monitoring;
    if (value === "write") {
      writeEnabled.value = true;
      continue;
    }
    if (value === "delete") {
      deleteEnabled.value = true;
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    if (typeof obj.read === "string" && !readTargets.value.includes(obj.read))
      readTargets.value.push(obj.read);
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
  [readTargets, writeEnabled, deleteEnabled],
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
          "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.title",
        )
      }}
    </summary>
    <div class="mt-3 space-y-2">
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.read",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="field in FIELDS"
          :key="`dm-r-${field}`"
          type="button"
          size="sm"
          :variant="readTargets.includes(field) ? 'default' : 'outline'"
          @click="toggleReadTarget(field)"
          >{{ field }}</Button
        >
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.write",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="writeEnabled ? 'default' : 'outline'"
          @click="toggleWrite"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.write",
            )
          }}
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.delete",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="deleteEnabled ? 'default' : 'outline'"
          @click="toggleDelete"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoring.delete",
            )
          }}
        </Button>
      </div>
    </div>
  </details>
</template>
