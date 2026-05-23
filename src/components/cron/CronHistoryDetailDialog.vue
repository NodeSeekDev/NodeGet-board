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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      (taskType === "ping" || taskType === "tcp_ping" || taskType === "http_ping") &&
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
      return value.args?.length ? `${value.cmd} ${value.args.join(" ")}` : value.cmd;
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
    <DialogContent class="bg-background max-w-3xl overflow-hidden p-0 sm:rounded-2xl">
      <DialogHeader class="p-6 pb-0">
        <DialogTitle class="flex items-center gap-2 text-lg font-semibold">
          {{ t("dashboard.cron.history.detailTitle") }}
        </DialogTitle>
      </DialogHeader>

      <div v-if="record" class="flex max-h-[85vh] flex-col gap-6 overflow-y-auto p-6 pt-4">
        <div class="bg-muted/30 flex flex-col gap-1.5 rounded-xl border p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
                >Cron ID</span
              >
              <span class="font-mono text-sm font-semibold">{{ record.cron_id }}</span>
            </div>

            <div class="flex shrink-0">
              <div
                class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                :class="
                  record.success
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                "
              >
                <CheckCircle2 v-if="record.success" class="h-3.5 w-3.5" />
                <XCircle v-else class="h-3.5 w-3.5" />
                {{
                  record.success
                    ? t("dashboard.cron.history.success")
                    : t("dashboard.cron.history.failed")
                }}
              </div>
            </div>
          </div>

          <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span>{{ t("dashboard.cron.history.executionTime") }}:</span>
            <span class="font-mono">{{ formatTime(record.run_time) }}</span>
          </div>
        </div>

        <div
          v-if="loadingTask"
          class="text-muted-foreground flex flex-col items-center justify-center space-y-3 py-12"
        >
          <Loader2 class="text-muted-foreground/50 h-8 w-8 animate-spin" />
          <span class="text-sm font-medium">{{ t("common.loading") }}</span>
        </div>

        <div v-else-if="taskResults.length" class="space-y-4">
          <h3 class="text-foreground/80 flex items-center gap-2 text-sm font-semibold">
            <Terminal class="h-4 w-4" />
            {{ t("dashboard.cron.history.taskResults") }}
          </h3>

          <div class="space-y-4">
            <div
              v-for="(task, index) in taskResults"
              :key="index"
              class="bg-card overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md"
            >
              <div class="bg-muted/20 flex items-center justify-between border-b p-3.5">
                <div class="flex items-center gap-2.5">
                  <span class="text-foreground/90 text-sm font-medium capitalize">{{
                    getTaskType(task.task_event_type)
                  }}</span>
                  <span
                    class="bg-muted/60 text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs break-all"
                  >
                    {{ getTaskTarget(task.task_event_type) }}
                  </span>
                </div>
                <div
                  class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="
                    task.success
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  "
                >
                  <CheckCircle2 v-if="task.success" class="h-3 w-3" />
                  <XCircle v-else class="h-3 w-3" />
                  {{
                    task.success
                      ? t("dashboard.cron.history.success")
                      : t("dashboard.cron.history.failed")
                  }}
                </div>
              </div>

              <div class="space-y-4 p-4">
                <div
                  v-if="task.error_message"
                  class="text-destructive bg-destructive/10 border-destructive/20 flex gap-2 rounded-lg border px-4 py-3 text-sm"
                >
                  <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
                  <span class="flex-1 break-words whitespace-pre-wrap">{{
                    task.error_message
                  }}</span>
                </div>

                <div
                  v-if="task.task_event_result"
                  class="bg-muted/40 relative overflow-x-auto rounded-lg border px-4 py-3 font-mono text-sm"
                >
                  <pre
                    class="text-muted-foreground text-[13px] leading-relaxed break-words whitespace-pre-wrap"
                    style="word-break: break-word"
                    >{{
                      formatResult(getTaskType(task.task_event_type), task.task_event_result)
                    }}</pre
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="text-muted-foreground flex flex-col items-center justify-center space-y-3 py-12"
        >
          <div class="bg-muted/50 flex h-12 w-12 items-center justify-center rounded-full">
            <Inbox class="text-muted-foreground/60 h-6 w-6" />
          </div>
          <p class="text-sm font-medium">
            {{ t("dashboard.cron.history.noTaskResult") }}
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
