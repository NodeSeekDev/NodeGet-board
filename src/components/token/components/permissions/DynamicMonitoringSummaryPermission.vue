<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";
import { arePermissionEntriesEqual } from "./permissionsState";
import { usePermissionModuleOpen } from "./usePermissionModuleOpen";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const readEnabled = ref(false);
const writeEnabled = ref(false);
const deleteEnabled = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  if (readEnabled.value) {
    result.push({ dynamic_monitoring_summary: "read" });
  }
  if (writeEnabled.value) {
    result.push({ dynamic_monitoring_summary: "write" });
  }
  if (deleteEnabled.value) {
    result.push({ dynamic_monitoring_summary: "delete" });
  }
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  readEnabled.value = false;
  writeEnabled.value = false;
  deleteEnabled.value = false;

  for (const entry of entries || []) {
    const value = entry?.dynamic_monitoring_summary;
    if (value === "read") {
      readEnabled.value = true;
      continue;
    }
    if (value === "write") {
      writeEnabled.value = true;
      continue;
    }
    if (value === "delete") {
      deleteEnabled.value = true;
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
  [readEnabled, writeEnabled, deleteEnabled],
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
          "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.title",
        )
      }}
    </summary>
    <div class="mt-3 space-y-2">
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.read",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="readEnabled ? 'default' : 'outline'"
          @click="readEnabled = !readEnabled"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.read",
            )
          }}
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.write",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="writeEnabled ? 'default' : 'outline'"
          @click="writeEnabled = !writeEnabled"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.write",
            )
          }}
        </Button>
      </div>
      <div class="text-xs text-muted-foreground">
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.delete",
          )
        }}
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="deleteEnabled ? 'default' : 'outline'"
          @click="deleteEnabled = !deleteEnabled"
        >
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.dynamicMonitoringSummary.delete",
            )
          }}
        </Button>
      </div>
    </div>
  </details>
</template>
