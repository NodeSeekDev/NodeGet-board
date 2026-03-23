<script setup lang="ts">
import { ref, watch } from "vue";
import type { AcceptableInputValue } from "reka-ui";
import type { PermissionEntry } from "../../type";
import { Button } from "@/components/ui/button";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import {
  addKvTarget,
  buildKvPermissions,
  hydrateKvPermissions,
  isSameKvPermissionState,
} from "./kvPermissionState";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const listAllKeys = ref(false);
const listAllNamespace = ref(false);
const readTargets = ref<string[]>([]);
const writeTargets = ref<string[]>([]);
const deleteTargets = ref<string[]>([]);
const hydrating = ref(false);

const build = (): PermissionEntry[] => {
  return buildKvPermissions({
    listAllKeys: listAllKeys.value,
    listAllNamespace: listAllNamespace.value,
    readTargets: readTargets.value,
    writeTargets: writeTargets.value,
    deleteTargets: deleteTargets.value,
  });
};

const hydrate = (entries: PermissionEntry[]) => {
  const state = hydrateKvPermissions(Array.isArray(entries) ? entries : []);
  listAllKeys.value = state.listAllKeys;
  listAllNamespace.value = state.listAllNamespace;
  readTargets.value = state.readTargets;
  writeTargets.value = state.writeTargets;
  deleteTargets.value = state.deleteTargets;
};

type KvTargetKind = "read" | "write" | "delete";

const getTargetsRef = (kind: KvTargetKind) => {
  if (kind === "read") return readTargets;
  if (kind === "write") return writeTargets;
  return deleteTargets;
};

const normalizeTargets = (targets: AcceptableInputValue[]) => {
  return targets.filter(
    (target): target is string => typeof target === "string",
  );
};

const sanitizeTargets = (targets: string[]) => {
  let result: string[] = [];
  for (const target of targets) {
    result = addKvTarget(result, target);
  }
  return result;
};

const updateTargets = (kind: KvTargetKind, value: AcceptableInputValue[]) => {
  const targets = getTargetsRef(kind);
  const next = sanitizeTargets(normalizeTargets(value));
  if (
    next.length === targets.value.length &&
    next.every((item, index) => item === targets.value[index])
  ) {
    return;
  }
  targets.value = next;
};

watch(
  () => props.modelValue,
  (value) => {
    const nextEntries = Array.isArray(value) ? value : [];
    if (
      isSameKvPermissionState(nextEntries, {
        listAllKeys: listAllKeys.value,
        listAllNamespace: listAllNamespace.value,
        readTargets: readTargets.value,
        writeTargets: writeTargets.value,
        deleteTargets: deleteTargets.value,
      })
    ) {
      return;
    }

    hydrating.value = true;
    hydrate(nextEntries);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [listAllKeys, listAllNamespace, readTargets, writeTargets, deleteTargets],
  () => {
    if (hydrating.value) return;
    emits("update:modelValue", build());
  },
  { deep: true },
);
</script>

<template>
  <details class="rounded-md border p-3" open>
    <summary class="cursor-pointer select-none text-sm font-medium">Kv</summary>
    <div class="mt-3 space-y-3 space-x-2">
      <Button
        size="sm"
        :variant="listAllKeys ? 'default' : 'outline'"
        @click="listAllKeys = !listAllKeys"
        >ListAllKeys</Button
      >
      <Button
        size="sm"
        :variant="listAllNamespace ? 'default' : 'outline'"
        @click="listAllNamespace = !listAllNamespace"
        >ListAllNamespace</Button
      >

      <div class="space-y-3">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Read targets</div>
          <TagsInput
            :model-value="readTargets"
            class="flex-col items-stretch"
            :convert-value="(value) => value.trim()"
            @update:model-value="updateTargets('read', $event)"
          >
            <div class="flex flex-wrap gap-2">
              <TagsInputItem
                v-for="target in readTargets"
                :key="`read-${target}`"
                :value="target"
              >
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
            </div>
            <TagsInputInput placeholder="metadata_*" class="w-full px-0 pt-2" />
          </TagsInput>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Write targets</div>
          <TagsInput
            :model-value="writeTargets"
            class="flex-col items-stretch"
            :convert-value="(value) => value.trim()"
            @update:model-value="updateTargets('write', $event)"
          >
            <div class="flex flex-wrap gap-2">
              <TagsInputItem
                v-for="target in writeTargets"
                :key="`write-${target}`"
                :value="target"
              >
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
            </div>
            <TagsInputInput
              placeholder="runtime_config"
              class="w-full px-0 pt-2"
            />
          </TagsInput>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Delete targets</div>
          <TagsInput
            :model-value="deleteTargets"
            class="flex-col items-stretch"
            :convert-value="(value) => value.trim()"
            @update:model-value="updateTargets('delete', $event)"
          >
            <div class="flex flex-wrap gap-2">
              <TagsInputItem
                v-for="target in deleteTargets"
                :key="`delete-${target}`"
                :value="target"
              >
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
            </div>
            <TagsInputInput placeholder="temp_*" class="w-full px-0 pt-2" />
          </TagsInput>
        </div>
      </div>
    </div>
  </details>
</template>
