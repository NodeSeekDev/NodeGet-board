<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  CheckCircle2,
  XCircle,
  Hash,
  Clock,
  Activity,
  Terminal,
  AlertCircle,
  Inbox,
  Loader2,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useCronHistory,
  type CrontabResult,
  type TaskQueryResult,
} from "@/composables/useCronHistory";

const props = defineProps<{
  open: boolean;
  taskType: "agent" | "server";
  record: CrontabResult | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { t } = useI18n();
const { queryTask } = useCronHistory();

const taskResults = ref<TaskQueryResult[]>([]);
const loadingTask = ref(false);

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatResult = (taskType: string, result: any): string => {
  if (!result) return "";
  if (typeof result === "object") {
    if (
      (taskType === "ping" ||
        taskType === "tcp_ping" ||
        taskType === "http_ping") &&
      typeof result[taskType] === "number"
    ) {
      return `${result[taskType].toFixed(3)} ms`;
    }
    if (taskType === "execute" && typeof result.execute === "string") {
      return result.execute.trim();
    }
    return JSON.stringify(result);
  }
  return String(result);
};

const getTaskType = (taskEventType: Record<string, string>): string => {
  return Object.keys(taskEventType)[0] ?? "";
};

const getTaskTarget = (taskEventType: Record<string, any>): string => {
  const key = Object.keys(taskEventType)[0];
  if (!key) return "";
  const value = taskEventType[key];
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (key === "execute" && value.cmd) {
      return value.args?.length
        ? `${value.cmd} ${value.args.join(" ")}`
        : value.cmd;
    }
    return value.cmd ?? JSON.stringify(value);
  }
  return "";
};

const loadTaskDetail = async (record: CrontabResult) => {
  taskResults.value = [];
  if (props.taskType === "server") {
    return;
  }
  const taskId = record.relative_id;
  if (!taskId) return;

  loadingTask.value = true;
  try {
    const result = await queryTask([{ task_id: taskId }]);
    taskResults.value = result;
  } catch (error) {
    console.error("[CronHistory] task_query failed:", error);
  } finally {
    loadingTask.value = false;
  }
};

watch(
  () => props.open,
  (open) => {
    if (open && props.record) {
      loadTaskDetail(props.record);
    }
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-w-3xl sm:rounded-2xl p-0 overflow-hidden bg-background"
    >
      <DialogHeader class="p-6 pb-0">
        <DialogTitle class="text-lg font-semibold flex items-center gap-2">
          {{ t("dashboard.cron.history.detailTitle") }}
        </DialogTitle>
      </DialogHeader>

      <div
        v-if="record"
        class="flex flex-col gap-6 p-6 pt-4 max-h-[85vh] overflow-y-auto"
      >
        <div class="flex flex-col gap-1.5 p-4 bg-muted/30 border rounded-xl">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >Cron ID</span
              >
              <span class="font-mono text-sm font-semibold">{{
                record.cron_id
              }}</span>
            </div>

            <div class="flex shrink-0">
              <div
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                :class="
                  record.success
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                "
              >
                <CheckCircle2 v-if="record.success" class="w-3.5 h-3.5" />
                <XCircle v-else class="w-3.5 h-3.5" />
                {{
                  record.success
                    ? t("dashboard.cron.history.success")
                    : t("dashboard.cron.history.failed")
                }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{{ t("dashboard.cron.history.executionTime") }}:</span>
            <span class="font-mono">{{ formatTime(record.run_time) }}</span>
          </div>
        </div>

        <div
          v-if="loadingTask"
          class="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3"
        >
          <Loader2 class="w-8 h-8 animate-spin text-muted-foreground/50" />
          <span class="text-sm font-medium">{{ t("common.loading") }}</span>
        </div>

        <div v-else-if="taskResults.length" class="space-y-4">
          <h3
            class="text-sm font-semibold text-foreground/80 flex items-center gap-2"
          >
            <Terminal class="w-4 h-4" />
            {{ t("dashboard.cron.history.taskResults") }}
          </h3>

          <div class="space-y-4">
            <div
              v-for="(task, index) in taskResults"
              :key="index"
              class="border rounded-xl bg-card shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div
                class="flex items-center justify-between p-3.5 border-b bg-muted/20"
              >
                <div class="flex items-center gap-2.5">
                  <span
                    class="text-sm font-medium text-foreground/90 capitalize"
                    >{{ getTaskType(task.task_event_type) }}</span
                  >
                  <span
                    class="font-mono text-xs bg-muted/60 text-muted-foreground border px-2 py-0.5 rounded-md break-all"
                  >
                    {{ getTaskTarget(task.task_event_type) }}
                  </span>
                </div>
                <div
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0"
                  :class="
                    task.success
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  "
                >
                  <CheckCircle2 v-if="task.success" class="w-3 h-3" />
                  <XCircle v-else class="w-3 h-3" />
                  {{
                    task.success
                      ? t("dashboard.cron.history.success")
                      : t("dashboard.cron.history.failed")
                  }}
                </div>
              </div>

              <div class="p-4 space-y-4">
                <div
                  v-if="task.error_message"
                  class="flex gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg"
                >
                  <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                  <span class="break-words whitespace-pre-wrap flex-1">{{
                    task.error_message
                  }}</span>
                </div>

                <div
                  v-if="task.task_event_result"
                  class="relative text-sm bg-muted/40 border px-4 py-3 rounded-lg font-mono overflow-x-auto"
                >
                  <pre
                    class="text-muted-foreground text-[13px] leading-relaxed break-words whitespace-pre-wrap"
                    style="word-break: break-word"
                    >{{
                      formatResult(
                        getTaskType(task.task_event_type),
                        task.task_event_result,
                      )
                    }}</pre
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3"
        >
          <div
            class="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center"
          >
            <Inbox class="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p class="text-sm font-medium">
            {{ t("dashboard.cron.history.noTaskResult") }}
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
