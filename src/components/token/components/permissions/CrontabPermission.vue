<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const read = ref(false);
const write = ref(false);
const del = ref(false);
const hydrating = ref(false);

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
    hydrating.value = true;
    hydrate(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [read, write, del],
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
      Crontab
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        :variant="read ? 'default' : 'outline'"
        @click="read = !read"
        >Read</Button
      >
      <Button
        size="sm"
        :variant="write ? 'default' : 'outline'"
        @click="write = !write"
        >Write</Button
      >
      <Button
        size="sm"
        :variant="del ? 'default' : 'outline'"
        @click="del = !del"
        >Delete</Button
      >
    </div>
  </details>
</template>
