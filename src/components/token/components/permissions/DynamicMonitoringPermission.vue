<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";

const FIELDS = ["cpu", "system", "gpu"] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const readTargets = ref<string[]>([]);
const writeEnabled = ref(false);
const hydrating = ref(false);

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

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  for (const field of readTargets.value)
    result.push({ dynamic_monitoring: { read: field } });
  if (writeEnabled.value) result.push({ dynamic_monitoring: "write" });
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  readTargets.value = [];
  writeEnabled.value = false;
  for (const entry of entries || []) {
    const value = entry?.dynamic_monitoring;
    if (value === "write") {
      writeEnabled.value = true;
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
    hydrating.value = true;
    hydrate(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [readTargets, writeEnabled],
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
          type="button"
          size="sm"
          :variant="readTargets.includes(field) ? 'default' : 'outline'"
          @click="toggleReadTarget(field)"
          >{{ field }}</Button
        >
      </div>
      <div class="text-xs text-muted-foreground">Write</div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          :variant="writeEnabled ? 'default' : 'outline'"
          @click="toggleWrite"
          >Write</Button
        >
      </div>
    </div>
  </details>
</template>
