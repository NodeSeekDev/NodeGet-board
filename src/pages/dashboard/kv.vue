<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Database } from "lucide-vue-next";
import { useKv } from "@/composables/useKv";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KvNamespaceTable from "@/components/kv/KvNamespaceTable.vue";
import KvEntryTable from "@/components/kv/KvEntryTable.vue";
import KvFlatTable from "@/components/kv/KvFlatTable.vue";
import KvNodeTable from "@/components/kv/KvNodeTable.vue";
import KvCreateNamespaceDialog from "@/components/kv/KvCreateNamespaceDialog.vue";
import KvViewDialog from "@/components/kv/KvViewDialog.vue";
import KvSetDialog from "@/components/kv/KvSetDialog.vue";
import { useI18n } from "vue-i18n";

definePage({
  meta: {
    title: "router.kv",
    icon: Database,
    order: 9,
    group: "router.group.advanced",
  },
});

const kv = useKv();
const { t } = useI18n();

const activeTab = ref<"list" | "flat" | "node">("list");
const deletingNs = ref<string | null>(null);
const selectedNamespace = ref<string | null>(null);
const tabKeys = ref({ list: 0, flat: 0, node: 0 });

const handleTabChange = (tab: string) => {
  activeTab.value = tab as "list" | "flat" | "node";
  tabKeys.value[tab as keyof typeof tabKeys.value]++;
  if (tab === "list" || tab === "flat") {
    kv.fetchNamespaces();
  }
};

// Create namespace dialog
const createOpen = ref(false);
const createLoading = ref(false);
const createError = ref<string | null>(null);

// View dialog
const viewOpen = ref(false);
const viewKey = ref("");
const viewValue = ref<unknown>(undefined);
const viewLoading = ref(false);

// Edit dialog
const editOpen = ref(false);
const editKey = ref<string | undefined>(undefined);
const editValue = ref<unknown>(undefined);
const saveLoading = ref(false);

onMounted(() => kv.init());

const enterNamespace = async (ns: string) => {
  selectedNamespace.value = ns;
  kv.namespace.value = ns;
  await kv.fetchKeys();
};

const backToList = () => {
  selectedNamespace.value = null;
  kv.entries.value = [];
};

const handleCreate = async (ns: string) => {
  createError.value = null;
  createLoading.value = true;
  try {
    await kv.createNamespace(ns);
    createOpen.value = false;
    await kv.fetchNamespaces();
    toast.success(t("dashboard.kv.createSuccess", { ns }));
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : String(e);
  } finally {
    createLoading.value = false;
  }
};

const handleView = async (key: string) => {
  viewKey.value = key;
  viewValue.value = undefined;
  viewLoading.value = true;
  viewOpen.value = true;
  try {
    viewValue.value = await kv.getValue(key);
  } finally {
    viewLoading.value = false;
  }
};

const handleEdit = async (key: string) => {
  editKey.value = key;
  editValue.value = await kv.getValue(key);
  editOpen.value = true;
};

const handleSave = async (key: string, value: unknown) => {
  saveLoading.value = true;
  try {
    await kv.setValue(key, value);
    editOpen.value = false;
    if (editKey.value === undefined) {
      await kv.fetchKeys();
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    saveLoading.value = false;
  }
};

const handleDelete = async (key: string) => {
  if (!confirm(t("dashboard.kv.deleteConfirm", { key }))) return;
  try {
    await kv.deleteKey(key);
    toast.success(t("dashboard.kv.deleteSuccess"));
  } catch (e: unknown) {
    toast.error(
      e instanceof Error ? e.message : t("dashboard.kv.deleteFailed"),
    );
  }
};

const handleNsDelete = async (ns: string) => {
  deletingNs.value = ns;
  try {
    const { partialFailures } = await kv.deleteNamespace(ns);
    if (partialFailures.length > 0) {
      toast.warning(
        `部分 key 删除失败，namespace 仍存在：${partialFailures.join("、")}`,
      );
    } else {
      toast.success(`命名空间「${ns}」已删除`);
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : `删除命名空间失败`);
  } finally {
    deletingNs.value = null;
  }
};

const openAddKey = () => {
  editKey.value = undefined;
  editValue.value = undefined;
  editOpen.value = true;
};
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.kv.title") }}</h1>

    <!-- Tabs (only displayed in namespace list view) -->
    <Tabs
      v-if="!selectedNamespace"
      :model-value="activeTab"
      @update:model-value="handleTabChange($event as string)"
    >
      <TabsList>
        <TabsTrigger value="list">{{
          $t("dashboard.kv.normalView")
        }}</TabsTrigger>
        <TabsTrigger value="flat" v-if="false">{{
          $t("dashboard.kv.flatView")
        }}</TabsTrigger>
        <TabsTrigger value="node">{{
          $t("dashboard.kv.nodeView")
        }}</TabsTrigger>
      </TabsList>

      <!-- Normal View: namespace list -->
      <TabsContent value="list" class="mt-4">
        <KvNamespaceTable
          :key="tabKeys.list"
          :namespaces="kv.namespaces.value"
          :loading="kv.namespacesLoading.value"
          :deleting-ns="deletingNs"
          @select="enterNamespace"
          @open-create="createOpen = true"
          @delete="handleNsDelete"
          @refresh="() => kv.fetchNamespaces()"
        />
      </TabsContent>

      <!-- Flat View -->
      <TabsContent value="flat" class="mt-4">
        <KvFlatTable :key="tabKeys.flat" :namespaces="kv.namespaces.value" />
      </TabsContent>

      <!-- Node View -->
      <TabsContent value="node" class="mt-4">
        <KvNodeTable :key="tabKeys.node" />
      </TabsContent>
    </Tabs>

    <!-- Namespace Detail -->
    <template v-if="selectedNamespace">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="backToList">{{
            $t("dashboard.kv.back")
          }}</Button>
          <p class="text-sm text-muted-foreground">
            {{ $t("dashboard.kv.namespace") }}
            <span class="font-mono font-medium text-foreground">{{
              selectedNamespace
            }}</span>
            {{ $t("dashboard.kv.allKeys", { count: kv.entries.value.length }) }}
          </p>
        </div>
        <Button size="sm" @click="openAddKey">
          {{ $t("dashboard.kv.addKey") }}
        </Button>
      </div>

      <KvEntryTable
        :entries="kv.entries.value"
        :loading="kv.loading.value"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </template>

    <!-- Dialogs -->
    <KvCreateNamespaceDialog
      :open="createOpen"
      :loading="createLoading"
      :error="createError"
      @update:open="createOpen = $event"
      @create="handleCreate"
    />
    <KvViewDialog
      :open="viewOpen"
      :kv-key="viewKey"
      :loading="viewLoading"
      :value="viewValue"
      @update:open="viewOpen = $event"
    />
    <KvSetDialog
      :open="editOpen"
      :loading="saveLoading"
      :edit-key="editKey"
      :edit-value="editValue"
      @update:open="editOpen = $event"
      @save="handleSave"
    />
  </div>
</template>
