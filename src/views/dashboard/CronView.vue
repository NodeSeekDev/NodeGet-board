<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Plus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import CronTable from "@/components/cron/CronTable.vue";
import CronFormDialog from "@/components/cron/CronFormDialog.vue";
import { useCron, backendToTask, taskToCronType } from "@/composables/useCron";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import type { CronTask } from "@/composables/useCron";

export interface NodeItem {
  uuid: string;
  customName: string;
}

const { t } = useI18n();
const { currentBackend } = useBackendStore();
const cron = useCron();

const tasks = ref<CronTask[]>([]);
const loading = ref(false);
const nodes = ref<NodeItem[]>([]);
const togglingNames = ref<string[]>([]);
const deletingNames = ref<string[]>([]);
const saveLoading = ref(false);

const formatRpcSuccessMessage = (result: unknown, fallback: string) => {
  if (typeof result === "string" && result.trim()) return result;
  if (result && typeof result === "object" && "message" in result) {
    const message = (result as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

const getToggleEnabledState = (result: unknown, fallback: boolean) => {
  if (result && typeof result === "object" && "enabled" in result) {
    const enabled = (result as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return fallback;
};

const fetchNodes = async () => {
  if (!currentBackend.value?.url) {
    nodes.value = [];
    return;
  }
  try {
    const result = await getWsConnection(currentBackend.value.url).call<{
      uuids: string[];
    }>("nodeget-server_list_all_agent_uuid", {
      token: currentBackend.value.token,
    });
    const uuids: string[] = result?.uuids ?? [];

    if (uuids.length === 0) {
      nodes.value = [];
      return;
    }

    const kvResult = await getWsConnection(currentBackend.value.url).call<
      { namespace: string; key: string; value: unknown }[]
    >("kv_get_multi_value", {
      token: currentBackend.value.token,
      namespace_key: uuids.map((uuid) => ({
        namespace: uuid,
        key: "metadata_name",
      })),
    });

    const nameMap = new Map<string, string>();
    for (const item of Array.isArray(kvResult) ? kvResult : []) {
      if (item.key === "metadata_name") {
        nameMap.set(item.namespace, String(item.value ?? ""));
      }
    }

    nodes.value = uuids.map((uuid) => ({
      uuid,
      customName: nameMap.get(uuid) ?? "",
    }));
  } catch {
    nodes.value = [];
  }
};

const loadTasks = async () => {
  loading.value = true;
  try {
    const list = await cron.list();
    tasks.value = [...list].sort((a, b) => a.id - b.id).map(backendToTask);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
};

watch(
  () => [currentBackend.value?.url, currentBackend.value?.token],
  async ([url]) => {
    if (!url) {
      tasks.value = [];
      nodes.value = [];
      return;
    }

    await Promise.all([fetchNodes(), loadTasks()]);
  },
  { immediate: true },
);

// Form dialog
const formOpen = ref(false);
const editingTask = ref<CronTask | null>(null);

const openCreate = () => {
  editingTask.value = null;
  formOpen.value = true;
};

const openEdit = (task: CronTask) => {
  editingTask.value = task;
  formOpen.value = true;
};

const handleSave = async (data: Omit<CronTask, "id"> & { id?: number }) => {
  if (saveLoading.value) return;
  const cron_type = taskToCronType(data);
  saveLoading.value = true;
  try {
    if (data.id !== undefined) {
      const result = await cron.edit({
        name: data.name,
        cron_expression: data.cronExpression,
        cron_type,
      });
      toast.success(
        formatRpcSuccessMessage(result, t("dashboard.cron.updateSuccess")),
      );
    } else {
      const result = await cron.create({
        name: data.name,
        cron_expression: data.cronExpression,
        cron_type,
      });
      toast.success(
        formatRpcSuccessMessage(result, t("dashboard.cron.createSuccess")),
      );
    }
    formOpen.value = false;
    await loadTasks();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saveLoading.value = false;
  }
};

const handleDelete = async (name: string) => {
  if (deletingNames.value.includes(name)) return;

  deletingNames.value = [...deletingNames.value, name];
  try {
    const result = await cron.remove(name);
    toast.success(
      formatRpcSuccessMessage(result, t("dashboard.cron.deleteSuccess")),
    );
    await loadTasks();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    deletingNames.value = deletingNames.value.filter((item) => item !== name);
  }
};

const handleToggle = async (task: CronTask) => {
  if (togglingNames.value.includes(task.name)) return;

  const previousEnabled = task.enabled;
  const nextEnabled = !previousEnabled;
  task.enabled = nextEnabled;
  togglingNames.value = [...togglingNames.value, task.name];

  try {
    const result = await cron.setEnable(task.name, nextEnabled);
    const enabled = getToggleEnabledState(result, nextEnabled);
    task.enabled = enabled;
    toast.success(
      formatRpcSuccessMessage(
        result,
        enabled
          ? t("dashboard.cron.enableSuccess")
          : t("dashboard.cron.disableSuccess"),
      ),
    );
    await loadTasks();
  } catch (e: unknown) {
    task.enabled = previousEnabled;
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    togglingNames.value = togglingNames.value.filter(
      (name) => name !== task.name,
    );
  }
};

const handleUpdateNodes = async (name: string, agentIds: string[]) => {
  const task = tasks.value.find((t) => t.name === name);
  if (!task) return;
  try {
    const updatedTask: CronTask = { ...task, agentIds };
    const cron_type = taskToCronType(updatedTask);
    await cron.edit({ name, cron_expression: task.cronExpression, cron_type });
    await loadTasks();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t("dashboard.cron.title") }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t("dashboard.cron.desc") }}
        </p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4 mr-1.5" />
        {{ t("dashboard.cron.create") }}
      </Button>
    </div>

    <div class="rounded-md border">
      <CronTable
        :loading="loading"
        :tasks="tasks"
        :nodes="nodes"
        :toggling-names="togglingNames"
        :deleting-names="deletingNames"
        @edit="openEdit"
        @delete="handleDelete"
        @toggle-enabled="handleToggle"
        @update-nodes="handleUpdateNodes"
      />
    </div>

    <CronFormDialog
      v-model:open="formOpen"
      :task="editingTask"
      :nodes="nodes"
      :saving="saveLoading"
      @save="handleSave"
    />
  </div>
</template>
