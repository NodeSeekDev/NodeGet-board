<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import type { PermissionEntry } from "../../type";
import { Badge } from "@/components/ui/badge";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();

const readTargets = ref<string[]>([]);
const deleteTargets = ref<string[]>([]);
const readInput = ref("");
const deleteInput = ref("");
const readInputEl = ref<HTMLInputElement | null>(null);
const deleteInputEl = ref<HTMLInputElement | null>(null);
const hydrating = ref(false);

type CrontabResultKind = "read" | "delete";

const dedupeTargets = (targets: string[]) => {
  return [...new Set(targets.map((item) => item.trim()).filter(Boolean))];
};

const build = (): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  for (const target of dedupeTargets(readTargets.value)) {
    result.push({ crontab_result: { read: target } });
  }
  for (const target of dedupeTargets(deleteTargets.value)) {
    result.push({ crontab_result: { delete: target } });
  }
  return result;
};

const hydrate = (entries: PermissionEntry[]) => {
  const reads: string[] = [];
  const deletes: string[] = [];

  for (const entry of entries || []) {
    const value = entry?.crontab_result;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const obj = value as Record<string, unknown>;
    if (typeof obj.read === "string") reads.push(obj.read);
    if (typeof obj.delete === "string") deletes.push(obj.delete);
  }

  readTargets.value = dedupeTargets(reads);
  deleteTargets.value = dedupeTargets(deletes);
  readInput.value = "";
  deleteInput.value = "";
};

const isSameState = (entries: PermissionEntry[]) => {
  return JSON.stringify(hydrateToPayload(entries)) === JSON.stringify(build());
};

const hydrateToPayload = (entries: PermissionEntry[]) => {
  const reads: string[] = [];
  const deletes: string[] = [];

  for (const entry of entries || []) {
    const value = entry?.crontab_result;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const obj = value as Record<string, unknown>;
    if (typeof obj.read === "string") reads.push(obj.read);
    if (typeof obj.delete === "string") deletes.push(obj.delete);
  }

  const result: PermissionEntry[] = [];
  for (const target of dedupeTargets(reads)) {
    result.push({ crontab_result: { read: target } });
  }
  for (const target of dedupeTargets(deletes)) {
    result.push({ crontab_result: { delete: target } });
  }
  return result;
};

const getTargetsRef = (kind: CrontabResultKind) => {
  return kind === "read" ? readTargets : deleteTargets;
};

const getInputRef = (kind: CrontabResultKind) => {
  return kind === "read" ? readInput : deleteInput;
};

const getInputElRef = (kind: CrontabResultKind) => {
  return kind === "read" ? readInputEl : deleteInputEl;
};

const commitTag = (kind: CrontabResultKind) => {
  const targets = getTargetsRef(kind);
  const input = getInputRef(kind);
  const value = input.value.trim();
  if (value && !targets.value.includes(value)) {
    targets.value = [...targets.value, value];
  }
  input.value = "";
  nextTick(() => {
    getInputElRef(kind).value?.focus();
  });
};

const removeTag = (kind: CrontabResultKind, target: string) => {
  const targets = getTargetsRef(kind);
  targets.value = targets.value.filter((item) => item !== target);
  nextTick(() => {
    getInputElRef(kind).value?.focus();
  });
};

const handleTagKeydown = (event: KeyboardEvent, kind: CrontabResultKind) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commitTag(kind);
};

watch(
  () => props.modelValue,
  (value) => {
    const nextEntries = Array.isArray(value) ? value : [];
    if (isSameState(nextEntries)) return;

    hydrating.value = true;
    hydrate(nextEntries);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [readTargets, deleteTargets],
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
      CrontabResult
    </summary>
    <div class="mt-3 space-y-3">
      <div class="space-y-1">
        <div class="text-xs text-muted-foreground">Read targets</div>
        <div class="space-y-2 rounded-md border p-2 min-h-[90px]">
          <input
            ref="readInputEl"
            v-model="readInput"
            class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-1 text-base shadow-none outline-none md:text-sm"
            placeholder="history_*"
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
  </details>
</template>
