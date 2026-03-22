<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import type { PermissionEntry } from "../../type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  addKvTarget,
  buildKvPermissions,
  hydrateKvPermissions,
  isSameKvPermissionState,
  removeKvTarget,
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
const readInput = ref("");
const writeInput = ref("");
const deleteInput = ref("");
const readInputEl = ref<HTMLInputElement | null>(null);
const writeInputEl = ref<HTMLInputElement | null>(null);
const deleteInputEl = ref<HTMLInputElement | null>(null);
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
  readInput.value = "";
  writeInput.value = "";
  deleteInput.value = "";
};

type KvTargetKind = "read" | "write" | "delete";

const getTargetsRef = (kind: KvTargetKind) => {
  if (kind === "read") return readTargets;
  if (kind === "write") return writeTargets;
  return deleteTargets;
};

const getInputRef = (kind: KvTargetKind) => {
  if (kind === "read") return readInput;
  if (kind === "write") return writeInput;
  return deleteInput;
};

const getInputElRef = (kind: KvTargetKind) => {
  if (kind === "read") return readInputEl;
  if (kind === "write") return writeInputEl;
  return deleteInputEl;
};

const commitTag = (kind: KvTargetKind) => {
  const targets = getTargetsRef(kind);
  const input = getInputRef(kind);
  const next = addKvTarget(targets.value, input.value);
  if (next !== targets.value) {
    targets.value = next;
  }
  input.value = "";
  nextTick(() => {
    getInputElRef(kind).value?.focus();
  });
};

const removeTag = (kind: KvTargetKind, target: string) => {
  const targets = getTargetsRef(kind);
  targets.value = removeKvTarget(targets.value, target);
  nextTick(() => {
    getInputElRef(kind).value?.focus();
  });
};

const handleTagKeydown = (event: KeyboardEvent, kind: KvTargetKind) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commitTag(kind);
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
          <div class="space-y-2 rounded-md border p-2 min-h-[90px]">
            <input
              ref="readInputEl"
              v-model="readInput"
              class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-1 text-base shadow-none outline-none md:text-sm"
              placeholder="metadata_*"
              @keydown="handleTagKeydown($event, 'read')"
            />
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="target in readTargets"
                :key="`read-${target}`"
                variant="secondary"
                class="flex items-center gap-1 pr-1"
              >
                {{ target }}
                <button
                  type="button"
                  class="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  @click="removeTag('read', target)"
                >
                  <X class="h-3 w-3" />
                </button>
              </Badge>
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Write targets</div>
          <div class="space-y-2 rounded-md border p-2 min-h-[90px]">
            <input
              ref="writeInputEl"
              v-model="writeInput"
              class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-1 text-base shadow-none outline-none md:text-sm"
              placeholder="runtime_config"
              @keydown="handleTagKeydown($event, 'write')"
            />
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="target in writeTargets"
                :key="`write-${target}`"
                variant="secondary"
                class="flex items-center gap-1 pr-1"
              >
                {{ target }}
                <button
                  type="button"
                  class="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  @click="removeTag('write', target)"
                >
                  <X class="h-3 w-3" />
                </button>
              </Badge>
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">Delete targets</div>
          <div class="space-y-2 rounded-md border p-2 min-h-[90px]">
            <input
              ref="deleteInputEl"
              v-model="deleteInput"
              class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-1 text-base shadow-none outline-none md:text-sm"
              placeholder="temp_*"
              @keydown="handleTagKeydown($event, 'delete')"
            />
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="target in deleteTargets"
                :key="`delete-${target}`"
                variant="secondary"
                class="flex items-center gap-1 pr-1"
              >
                {{ target }}
                <button
                  type="button"
                  class="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  @click="removeTag('delete', target)"
                >
                  <X class="h-3 w-3" />
                </button>
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
