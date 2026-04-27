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

const read = ref(false);
const write = ref(false);
const del = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  if (read.value) result.push({ crontab: "read" });
  if (write.value) result.push({ crontab: "write" });
  if (del.value) result.push({ crontab: "delete" });
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  read.value = false;
  write.value = false;
  del.value = false;
  for (const entry of entries || []) {
    if (entry?.crontab === "read") read.value = true;
    if (entry?.crontab === "write") write.value = true;
    if (entry?.crontab === "delete") del.value = true;
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
  [read, write, del],
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
          "dashboard.token.permissionsConfig.limitItem.permissionCard.crontab.title",
        )
      }}
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        :variant="read ? 'default' : 'outline'"
        @click="read = !read"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.crontab.read",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="write ? 'default' : 'outline'"
        @click="write = !write"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.crontab.write",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="del ? 'default' : 'outline'"
        @click="del = !del"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.crontab.delete",
          )
        }}
      </Button>
    </div>
  </details>
</template>
