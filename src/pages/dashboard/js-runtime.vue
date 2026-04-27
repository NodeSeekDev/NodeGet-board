<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Braces, Plus, RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import WorkerTable from "@/components/js-runtime/WorkerTable.vue";
import WorkerFormDialog from "@/components/js-runtime/WorkerFormDialog.vue";
import { useJsRuntime } from "@/composables/useJsRuntime";

definePage({
  meta: {
    title: "router.jsRuntime",
    icon: Braces,
    order: 10,
    group: "router.group.advanced",
  },
});

const { t } = useI18n();
const route = useRoute();
const runtime = useJsRuntime();

const deletingIds = ref<string[]>([]);
const saveLoading = ref(false);
const dialogOpen = ref(false);

const listAllWorkersFun = async () => {
  runtime.loading.value = true;
  try {
    const names = await runtime.listAllWorkers();
    const details = await Promise.all(
      names.map(async (name) => {
        return await runtime.getWorker(name);
      }),
    );
    runtime.workers.value = details.filter((w) => w !== null) as any[];
  } catch (e: any) {
    console.error("Failed to load workers", e);
    toast.error(e.message || "Failed to load workers");
  } finally {
    runtime.loading.value = false;
  }
};

onMounted(() => {
  listAllWorkersFun();
});

const addWorkerFun = async (name: string, content: string) => {
  saveLoading.value = true;
  try {
    await runtime.addWorker({
      name,
      content,
      runtimeCleanTime: 120000,
    });
    toast.success(t("dashboard.jsRuntime.createSuccess"));
    dialogOpen.value = false;
    await listAllWorkersFun();
  } catch (e: any) {
    toast.error(e.message || "Failed to create worker");
  } finally {
    saveLoading.value = false;
  }
};

const deleteWorkerFun = async (name: string) => {
  deletingIds.value.push(name);
  try {
    await runtime.deleteWorker(name);
    toast.success(t("dashboard.jsRuntime.deleteSuccess"));
    await listAllWorkersFun();
  } catch (e: any) {
    toast.error(e.message || "Failed to delete worker");
  } finally {
    deletingIds.value = deletingIds.value.filter((i) => i !== name);
  }
};
</script>

<template>
  <div v-if="route.path === '/dashboard/js-runtime'" class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t("dashboard.jsRuntime.title") }}
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t("dashboard.jsRuntime.desc") }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          :disabled="runtime.loading.value"
          @click="listAllWorkersFun"
        >
          <RotateCcw
            class="h-4 w-4"
            :class="{ 'animate-spin': runtime.loading.value }"
          />
        </Button>
        <Button @click="dialogOpen = true">
          <Plus class="mr-2 h-4 w-4" />
          {{ t("dashboard.jsRuntime.addWorker") }}
        </Button>
      </div>
    </div>

    <WorkerTable
      :workers="runtime.workers.value"
      :loading="runtime.loading.value"
      :deleting-ids="deletingIds"
      @delete="deleteWorkerFun"
    />

    <WorkerFormDialog
      v-model:open="dialogOpen"
      :loading="saveLoading"
      @save="addWorkerFun"
    />
  </div>
  <router-view v-else />
</template>
