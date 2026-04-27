<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";
import { arePermissionEntriesEqual } from "./permissionsState";
import { usePermissionModuleOpen } from "./usePermissionModuleOpen";

const READ_FIELDS = ["cpu", "system", "gpu"] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const writeEnabled = ref(false);
const deleteEnable = ref(false);
const readTargets = ref<string[]>([]);
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

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  if (writeEnabled.value) result.push({ static_monitoring: "write" });
  if (deleteEnable.value) result.push({ static_monitoring: "delete" });
  for (const target of readTargets.value) {
    result.push({ static_monitoring: { read: target } });
  }
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  writeEnabled.value = false;
  readTargets.value = [];
  deleteEnable.value = false;

  for (const entry of entries || []) {
    const value = entry?.static_monitoring;
    if (value === "write") {
      writeEnabled.value = true;
      continue;
    }
    if (value === "delete") {
      deleteEnable.value = true;
      continue;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;

    if (typeof obj.read === "string" && !readTargets.value.includes(obj.read)) {
      readTargets.value.push(obj.read);
      continue;
    }

    if (typeof obj.write === "string") {
      writeEnabled.value = true;
    }
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
  [writeEnabled, readTargets, deleteEnable],
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
          "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.title",
        )
      }}
    </summary>
    <div class="mt-3 space-y-2">
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.read",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="field in READ_FIELDS"
          :key="`sm-r-${field}`"
          size="sm"
          type="button"
          :variant="readTargets.includes(field) ? 'default' : 'outline'"
          @click="toggleReadTarget(field)"
        >
          {{ field }}
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.write",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          type="button"
          :variant="writeEnabled ? 'default' : 'outline'"
          @click="writeEnabled = !writeEnabled"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.write",
            )
          }}
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.delete",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          type="button"
          :variant="deleteEnable ? 'default' : 'outline'"
          @click="deleteEnable = !deleteEnable"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.staticMonitoring.delete",
            )
          }}
        </Button>
      </div>
    </div>
  </details>
</template>
