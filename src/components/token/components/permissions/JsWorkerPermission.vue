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

const listAllJsWorker = ref(false);
const create = ref(false);
const read = ref(false);
const write = ref(false);
const remove = ref(false);
const runDefinedJsWorker = ref(false);
const runRawJsWorker = ref(false);
const hydrating = ref(false);
const { isOpen, handleToggle } = usePermissionModuleOpen(
  () => props.modelValue,
);

const build = (): PermissionEntry[] => {
  const entries: PermissionEntry[] = [];

  if (listAllJsWorker.value) {
    entries.push({ js_worker: "list_all_js_worker" });
  }
  if (create.value) {
    entries.push({ js_worker: "create" });
  }
  if (read.value) {
    entries.push({ js_worker: "read" });
  }
  if (write.value) {
    entries.push({ js_worker: "write" });
  }
  if (remove.value) {
    entries.push({ js_worker: "delete" });
  }
  if (runDefinedJsWorker.value) {
    entries.push({ js_worker: "run_defined_js_worker" });
  }
  if (runRawJsWorker.value) {
    entries.push({ js_worker: "run_raw_js_worker" });
  }

  return entries;
};

const hydrate = (entries: PermissionEntry[]) => {
  listAllJsWorker.value = entries.some(
    (entry) => entry?.js_worker === "list_all_js_worker",
  );
  create.value = entries.some((entry) => entry?.js_worker === "create");
  read.value = entries.some((entry) => entry?.js_worker === "read");
  write.value = entries.some((entry) => entry?.js_worker === "write");
  remove.value = entries.some((entry) => entry?.js_worker === "delete");
  runDefinedJsWorker.value = entries.some(
    (entry) => entry?.js_worker === "run_defined_js_worker",
  );
  runRawJsWorker.value = entries.some(
    (entry) => entry?.js_worker === "run_raw_js_worker",
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

watch(
  [
    listAllJsWorker,
    create,
    read,
    write,
    remove,
    runDefinedJsWorker,
    runRawJsWorker,
  ],
  () => {
    if (hydrating.value) return;
    const nextEntries = build();
    if (arePermissionEntriesEqual(nextEntries, props.modelValue)) return;
    emits("update:modelValue", nextEntries);
  },
);
</script>

<template>
  <details class="rounded-md border p-3" :open="isOpen" @toggle="handleToggle">
    <summary class="cursor-pointer select-none text-sm font-medium">
      {{
        t(
          "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.title",
        )
      }}
    </summary>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        :variant="listAllJsWorker ? 'default' : 'outline'"
        @click="listAllJsWorker = !listAllJsWorker"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.listAllJsWorker",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="create ? 'default' : 'outline'"
        @click="create = !create"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.create",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="read ? 'default' : 'outline'"
        @click="read = !read"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.read",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="write ? 'default' : 'outline'"
        @click="write = !write"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.write",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="remove ? 'default' : 'outline'"
        @click="remove = !remove"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.delete",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="runDefinedJsWorker ? 'default' : 'outline'"
        @click="runDefinedJsWorker = !runDefinedJsWorker"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.runDefinedJsWorker",
          )
        }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="runRawJsWorker ? 'default' : 'outline'"
        @click="runRawJsWorker = !runRawJsWorker"
      >
        {{
          t(
            "dashboard.token.permissionsConfig.limitItem.permissionCard.jsWorker.runRawJsWorker",
          )
        }}
      </Button>
    </div>
  </details>
</template>
