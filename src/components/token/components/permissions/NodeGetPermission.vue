<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const listAllAgentUuid = ref(false);
const hydrating = ref(false);

const build = (): PermissionEntry[] =>
  listAllAgentUuid.value ? [{ nodeget: "list_all_agent_uuid" }] : [];

const hydrate = (entries: PermissionEntry[]) => {
  listAllAgentUuid.value = entries.some(
    (entry) => entry?.nodeget === "list_all_agent_uuid",
  );
};

watch(
  () => props.modelValue,
  (value) => {
    hydrating.value = true;
    hydrate(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(listAllAgentUuid, () => {
  if (hydrating.value) return;
  emits("update:modelValue", build());
});
</script>

<template>
  <details class="rounded-md border p-3" open>
    <summary class="cursor-pointer select-none text-sm font-medium">
      NodeGet
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        :variant="listAllAgentUuid ? 'default' : 'outline'"
        @click="listAllAgentUuid = !listAllAgentUuid"
        >ListAllAgentUuid</Button
      >
    </div>
  </details>
</template>
