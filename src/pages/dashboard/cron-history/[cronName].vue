<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { ArrowLeft } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import CronHistoryFilter from "@/components/cron/CronHistoryFilter.vue";
import CronHistoryTable from "@/components/cron/CronHistoryTable.vue";
import CronHistoryDetailDialog from "@/components/cron/CronHistoryDetailDialog.vue";
import {
  useCronHistory,
  type CrontabResult,
} from "@/composables/useCronHistory";
import type { FilterState } from "@/components/cron/CronHistoryFilter.vue";

definePage({
  meta: {
    title: "router.cronHistory",
    hidden: true,
  },
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { query } = useCronHistory();

const cronName = computed(
  () => (route.params as { cronName: string }).cronName,
);
const taskType = computed(() => {
  const value = route.query.taskType;
  return value === "server" ? "server" : "agent";
});
const allRecords = ref<CrontabResult[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

const filter = ref<FilterState>({
  id: "",
  startTime: formatDateTimeLocal(oneHourAgo),
  endTime: formatDateTimeLocal(now),
  status: "all",
  limit: 20,
  latestOnly: false,
});

const records = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return allRecords.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() =>
  Math.ceil(allRecords.value.length / pageSize.value),
);

const buildCondition = () => {
  const condition: any[] = [
    { cron_name: cronName.value },
    { limit: Math.max(1, filter.value.limit || 20) },
  ];

  if (filter.value.id) {
    const id = Number(filter.value.id);
    if (!Number.isNaN(id) && id > 0) condition.push({ id });
  }

  if (
    !filter.value.latestOnly &&
    filter.value.startTime &&
    filter.value.endTime
  ) {
    const startTs = new Date(filter.value.startTime).getTime();
    const endTs = new Date(filter.value.endTime).getTime();
    condition.push({ run_time_from_to: [startTs, endTs] });
  }

  if (filter.value.status === "success") {
    condition.push({ is_success: null });
  } else if (filter.value.status === "failed") {
    condition.push({ is_success: false });
  }

  if (filter.value.latestOnly) {
    condition.push({ last: null });
  }

  return condition;
};

const loadData = async () => {
  if (loading.value) return;

  loading.value = true;
  try {
    const condition = buildCondition();
    const result = await query(condition);
    allRecords.value = result;
    currentPage.value = 1;
  } catch (error) {
    console.error("Failed to load cron history:", error);
    toast.error(t("common.error"), {
      description: String(error),
    });
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  loadData();
};

const handleReset = () => {
  loadData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const detailOpen = ref(false);
const selectedRecord = ref<CrontabResult | null>(null);

const handleView = (id: number) => {
  if (taskType.value !== "agent") return;

  const record = allRecords.value.find((r) => r.id === id);
  if (!record) return;

  selectedRecord.value = record;
  detailOpen.value = true;
};

const handleDelete = (id: number) => {
  // TODO: 实现删除功能
  console.log("[CronHistory] delete:", id);
};

const goBack = () => {
  router.push({ name: "/dashboard/cron" });
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button size="icon" variant="ghost" @click="goBack">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold">
            {{ t("dashboard.cron.history.title") }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ t("dashboard.cron.history.taskName") }}: {{ cronName }}
          </p>
        </div>
      </div>
    </div>

    <CronHistoryFilter
      v-model="filter"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CronHistoryTable
      :records="records"
      :loading="loading"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size="pageSize"
      :task-type="taskType"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
      @view="handleView"
      @delete="handleDelete"
    />

    <CronHistoryDetailDialog
      v-if="taskType === 'agent'"
      v-model:open="detailOpen"
      :task-type="taskType"
      :record="selectedRecord"
    />
  </div>
</template>
