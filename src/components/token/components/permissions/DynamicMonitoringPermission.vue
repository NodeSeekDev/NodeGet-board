<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";

const FIELDS = ["cpu", "system", "gpu", "disk"] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const readTargets = ref<string[]>([]);
const writeTargets = ref<string[]>([]);
const hydrating = ref(false);

const toggle = (list: string[], value: string) => {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
};

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  for (const field of readTargets.value)
    result.push({ dynamic_monitoring: { read: field } });
  for (const field of writeTargets.value)
    result.push({ dynamic_monitoring: { write: field } });
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  readTargets.value = [];
  writeTargets.value = [];
  for (const entry of entries || []) {
    const value = entry?.dynamic_monitoring;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
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
    hydrating.value = true;
    hydrate(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [readTargets, writeTargets],
  () => {
    if (hydrating.value) return;
    emits("update:modelValue", build());
  },
  { deep: true },
);
</script>

<template>
  <details class="rounded-md border p-3" open>
    <summary class="cursor-pointer select-none text-sm font-medium">
      DynamicMonitoring
    </summary>
    <div class="mt-3 space-y-2">
      <div class="text-xs text-muted-foreground">Read</div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="field in FIELDS"
          :key="`dm-r-${field}`"
          size="sm"
          :variant="readTargets.includes(field) ? 'default' : 'outline'"
          @click="toggle(readTargets, field)"
          >{{ field }}</Button
        >
      </div>
      <div class="text-xs text-muted-foreground">Write</div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="field in FIELDS"
          :key="`dm-w-${field}`"
          size="sm"
          :variant="writeTargets.includes(field) ? 'default' : 'outline'"
          @click="toggle(writeTargets, field)"
          >{{ field }}</Button
        >
      </div>
    </div>
  </details>
</template>
