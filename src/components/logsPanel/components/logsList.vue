<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2 } from "lucide-vue-next";
import type { LogActionStatus, LogEntry, LogStatus } from "@/composables/useLogs";
import LogsItem from "./logsItem.vue";

interface LogsListProps {
  logs: LogEntry[];
  error: string | null;
  status: LogStatus;
  actionStatus: LogActionStatus;
  isBusy: boolean;
}

const props = defineProps<LogsListProps>();
const { t } = useI18n();

const displayLogs = computed(() => [...props.logs].reverse());
const loadingText = computed(() => {
  if (props.actionStatus === "connecting") {
    return t("dashboard.logsPanel.loading.connecting");
  }
  if (props.actionStatus === "disconnecting") {
    return t("dashboard.logsPanel.loading.disconnecting");
  }
  if (props.actionStatus === "reconnecting") {
    return t("dashboard.logsPanel.loading.reconnecting");
  }
  if (props.actionStatus === "updatingFilters") {
    return t("dashboard.logsPanel.loading.updatingFilters");
  }
  return t("common.loading");
});
</script>

<template>
  <div class="bg-background/30 mt-4 max-h-[60vh] overflow-y-auto rounded-md border p-2">
    <div class="space-y-2">
      <div
        v-if="isBusy"
        class="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
      >
        <Loader2 class="h-3.5 w-3.5 animate-spin" />
        <span>{{ loadingText }}</span>
      </div>

      <div
        v-if="error"
        class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-2.5 py-1.5 text-xs"
      >
        {{ error }}
      </div>

      <div
        v-if="logs.length === 0"
        class="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs"
      >
        <span v-if="status === 'connecting'">
          {{ t("dashboard.logsPanel.empty.connecting") }}
        </span>
        <span v-else-if="isBusy">{{ loadingText }}</span>
        <span v-else>{{ t("dashboard.logsPanel.empty.idle") }}</span>
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <LogsItem v-for="item in displayLogs" :key="item.id" :item="item" />
      </div>
    </div>
  </div>
</template>
