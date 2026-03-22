<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";

const READ_FIELDS = ["cpu", "system", "gpu"] as const;

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const writeEnabled = ref(false);
const readTargets = ref<string[]>([]);
const hydrating = ref(false);

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
  for (const target of readTargets.value) {
    result.push({ static_monitoring: { read: target } });
  }
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  writeEnabled.value = false;
  readTargets.value = [];

  for (const entry of entries || []) {
    const value = entry?.static_monitoring;
    if (value === "write") {
      writeEnabled.value = true;
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
    hydrating.value = true;
    hydrate(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [writeEnabled, readTargets],
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
      静态监控
    </summary>
    <div class="mt-3 space-y-2">
      <div class="text-xs text-muted-foreground">Write</div>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          :variant="writeEnabled ? 'default' : 'outline'"
          @click="writeEnabled = !writeEnabled"
        >
          Write
        </Button>
      </div>

      <div class="text-xs text-muted-foreground">Read</div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="field in READ_FIELDS"
          :key="`sm-r-${field}`"
          size="sm"
          :variant="readTargets.includes(field) ? 'default' : 'outline'"
          @click="toggleReadTarget(field)"
        >
          {{ field }}
        </Button>
      </div>
    </div>
  </details>
</template>
