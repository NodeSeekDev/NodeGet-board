<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { useKv } from "@/composables/useKv";
import KvEntryTable from "./KvEntryTable.vue";
import KvViewDialog from "./KvViewDialog.vue";
import KvSetDialog from "./KvSetDialog.vue";

interface FlatEntry {
  namespace: string;
  key: string;
  value: unknown;
}

const props = defineProps<{
  namespaces: string[];
}>();

const kv = useKv();
const flatEntries = ref<FlatEntry[]>([]);
const flatLoading = ref(false);

const viewOpen = ref(false);
const viewKey = ref("");
const viewValue = ref<unknown>(undefined);

const editOpen = ref(false);
const editKey = ref<string | undefined>(undefined);
const editValue = ref<unknown>(undefined);
const editNamespace = ref("");

const loadAll = async () => {
  if (props.namespaces.length === 0) return;
  flatLoading.value = true;
  flatEntries.value = [];
  try {
    const namespaceKeys = props.namespaces.map((ns) => ({
      namespace: ns,
      key: "*",
    }));
    const results = await kv.getMultiValue(namespaceKeys);
    flatEntries.value = results.map((r) => ({
      namespace: r.namespace,
      key: r.key,
      value: r.value,
    }));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    flatLoading.value = false;
  }
};

onMounted(loadAll);

const handleView = (ns: string, key: string) => {
  const entry = flatEntries.value.find(
    (x) => x.namespace === ns && x.key === key,
  );
  viewKey.value = key;
  viewValue.value = entry?.value;
  viewOpen.value = true;
};

const handleEdit = (ns: string, key: string) => {
  const entry = flatEntries.value.find(
    (x) => x.namespace === ns && x.key === key,
  );
  editNamespace.value = ns;
  editKey.value = key;
  editValue.value = entry?.value;
  editOpen.value = true;
};

const handleSave = async (key: string, value: unknown) => {
  kv.namespace.value = editNamespace.value;
  try {
    await kv.setValue(key, value);
    editOpen.value = false;
    const entry = flatEntries.value.find(
      (e) => e.namespace === editNamespace.value && e.key === key,
    );
    if (entry) entry.value = value;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "更新失败");
  }
};

const handleDelete = async (ns: string, key: string) => {
  kv.namespace.value = ns;
  try {
    await kv.deleteKey(key);
    flatEntries.value = flatEntries.value.filter(
      (e) => !(e.namespace === ns && e.key === key),
    );
    toast.success("删除成功");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  }
};

// flatEntries is passed directly; KvEntryTable uses (entry as any).namespace for showNamespace columns
</script>

<template>
  <div>
    <KvEntryTable
      :entries="flatEntries as any"
      :loading="flatLoading"
      :show-namespace="true"
      @view="
        (key) => {
          const e = flatEntries.find((x) => x.key === key);
          if (e) handleView(e.namespace, key);
        }
      "
      @edit="
        (key) => {
          const e = flatEntries.find((x) => x.key === key);
          if (e) handleEdit(e.namespace, key);
        }
      "
      @delete="
        (key) => {
          const e = flatEntries.find((x) => x.key === key);
          if (e) handleDelete(e.namespace, key);
        }
      "
    />

    <KvViewDialog
      :open="viewOpen"
      :kv-key="viewKey"
      :value="viewValue"
      @update:open="viewOpen = $event"
    />
    <KvSetDialog
      :open="editOpen"
      :edit-key="editKey"
      :edit-value="editValue"
      @update:open="editOpen = $event"
      @save="handleSave"
    />
  </div>
</template>
