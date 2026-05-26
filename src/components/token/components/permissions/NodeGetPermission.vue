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

const listAllAgentUuid = ref(false);
const getRtPool = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const build = (): PermissionEntry[] => {
  const entries: PermissionEntry[] = [];

  if (listAllAgentUuid.value) {
    entries.push({ node_get: "list_all_agent_uuid" });
  }

  if (getRtPool.value) {
    entries.push({ node_get: "get_rt_pool" });
  }

  return entries;
};

const hydrate = (entries: PermissionEntry[]) => {
  listAllAgentUuid.value = entries.some(
    (entry) =>
      entry?.node_get === "list_all_agent_uuid" ||
      entry?.nodeget === "list_all_agent_uuid",
  );
  getRtPool.value = entries.some(
    (entry) =>
      entry?.node_get === "get_rt_pool" || entry?.nodeget === "get_rt_pool",
  );
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

watch([listAllAgentUuid, getRtPool], () => {
  if (hydrating.value) return;
  const nextEntries = build();
  if (arePermissionEntriesEqual(nextEntries, props.modelValue)) return;
  emits("update:modelValue", nextEntries);
});
</script>

<template>
  <details class="rounded-md border p-3" :open="isOpen" @toggle="handleToggle">
    <summary class="cursor-pointer select-none text-sm font-medium">
      NodeGet
      {{
        t(
          "dashboard.token.permissionsConfig.limitItem.permissionCard.nodeGet.title",
        )
      }}
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        :variant="listAllAgentUuid ? 'default' : 'outline'"
        @click="listAllAgentUuid = !listAllAgentUuid"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.nodeGet.listAllAgentUuid",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="getRtPool ? 'default' : 'outline'"
        @click="getRtPool = !getRtPool"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.nodeGet.getRtPool",
          )
        }}
      </Button>
    </div>
  </details>
</template>
