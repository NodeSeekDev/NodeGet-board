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

const connect = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const build = (): PermissionEntry[] =>
  connect.value ? [{ terminal: "connect" }] : [];

const hydrate = (entries: PermissionEntry[]) => {
  connect.value = entries.some((entry) => entry?.terminal === "connect");
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

watch(connect, () => {
  if (hydrating.value) return;
  const nextEntries = build();
  if (arePermissionEntriesEqual(nextEntries, props.modelValue)) return;
  emits("update:modelValue", nextEntries);
});
</script>

<template>
  <details class="rounded-md border p-3" :open="isOpen" @toggle="handleToggle">
    <summary class="cursor-pointer select-none text-sm font-medium">
      {{
        t(
          "dashboard.token.permissionsConfig.limitItem.permissionCard.terminal.title",
        )
      }}
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        :variant="connect ? 'default' : 'outline'"
        @click="connect = !connect"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.terminal.connect",
          )
        }}
      </Button>
    </div>
  </details>
</template>
