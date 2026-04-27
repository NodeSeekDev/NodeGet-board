<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { AcceptableInputValue } from "reka-ui";
import type { PermissionEntry } from "../../type";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import { usePermissionModuleOpen } from "./usePermissionModuleOpen";

const props = defineProps<{ modelValue: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:modelValue", value: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const readTargets = ref<string[]>([]);
const deleteTargets = ref<string[]>([]);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

type CrontabResultKind = "read" | "delete";

const dedupeTargets = (targets: string[]) => {
  return [...new Set(targets.map((item) => item.trim()).filter(Boolean))];
};

// 构建数据用于上层组件消费
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

// 解析上层组件的数据用于本地消费
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

const normalizeTargets = (targets: AcceptableInputValue[]) => {
  return targets.filter(
    (target): target is string => typeof target === "string",
  );
};

const updateTargets = (
  kind: CrontabResultKind,
  value: AcceptableInputValue[],
) => {
  const targets = getTargetsRef(kind);
  targets.value = dedupeTargets(normalizeTargets(value));
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
  <details class="rounded-md border p-3" :open="isOpen" @toggle="handleToggle">
    <summary class="cursor-pointer select-none text-sm font-medium">
      {{
        t(
          "dashboard.token.permissionsConfig.limitItem.permissionCard.crontabReault.title",
        )
      }}
    </summary>
    <div class="mt-3 space-y-3">
      <div class="space-y-1">
        <div class="text-xs text-muted-foreground">
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.crontabReault.readTarget",
            )
          }}
        </div>
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
          <TagsInputInput placeholder="history_*" class="w-full px-0 pt-2" />
        </TagsInput>
      </div>

      <div class="space-y-1">
        <div class="text-xs text-muted-foreground">
          {{
            t(
              "dashboard.token.permissionsConfig.limitItem.permissionCard.crontabReault.deleteTarget",
            )
          }}
        </div>
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
  </details>
</template>
