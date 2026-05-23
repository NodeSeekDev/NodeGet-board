<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useBackendStore } from "@/composables/useBackendStore";
import {
  LOG_LEVEL_OPTIONS,
  useLogs,
  type LogEntry,
  type LogLevel,
  type LogStatus,
} from "@/composables/useLogs";
import { formatDebugPayload, maskToken } from "../rpcDebugStore";
import RpcDebugDataTable from "./RpcDebugDataTable.vue";

const backendStore = useBackendStore();
const logsPanel = useLogs();

const currentBackend = computed(() => backendStore.currentBackend.value);
const selectedLevel = ref<LogLevel>(logsPanel.defaultLevel.value);

const statusLabels: Record<LogStatus, string> = {
  connecting: "连接中",
  connected: "订阅中",
  disconnected: "未订阅",
  paused: "已暂停",
  error: "订阅失败",
};

const subscriptionLabel = computed(() => logsPanel.subscriptionId.value || "暂无订阅");

watch(selectedLevel, async (level) => {
  if (logsPanel.defaultLevel.value === level) return;
  logsPanel.defaultLevel.value = level;
  logsPanel.clearLogs();
  if (
    logsPanel.status.value === "connected" ||
    logsPanel.status.value === "paused" ||
    logsPanel.status.value === "connecting"
  ) {
    await logsPanel.reconnect();
  }
});

onBeforeUnmount(() => {
  if (logsPanel.status.value !== "disconnected") {
    void logsPanel.stop();
  }
});

async function startSubscription() {
  logsPanel.defaultLevel.value = selectedLevel.value;
  await logsPanel.connect();
}

async function stopSubscription() {
  await logsPanel.stop();
}

const logColumns = computed<ColumnDef<LogEntry>[]>(() => [
  {
    id: "level",
    header: "级别",
    size: 70,
    cell: ({ row }) => row.original.level || "-",
    meta: { cellClass: "font-medium" },
  },
  {
    id: "target",
    header: "目标",
    size: 110,
    cell: ({ row }) => row.original.target || "-",
    meta: { cellClass: "max-w-[130px] truncate text-muted-foreground" },
  },
  {
    id: "message",
    header: "消息",
    size: 360,
    cell: ({ row }) => row.original.message || formatDebugPayload(row.original),
    meta: { cellClass: "max-w-[520px] truncate" },
  },
]);
</script>

<template>
  <div class="h-full p-6">
    <section class="mb-6 rounded-lg border p-5">
      <div class="grid gap-4 lg:grid-cols-[260px_360px_1fr]">
        <label class="grid gap-1.5">
          <span class="text-muted-foreground text-xs font-medium">日志级别</span>
          <select
            v-model="selectedLevel"
            class="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
          >
            <option v-for="level in LOG_LEVEL_OPTIONS" :key="level" :value="level">
              {{ level }}
            </option>
          </select>
        </label>
        <label class="grid gap-1.5">
          <span class="text-muted-foreground text-xs font-medium">当前 SuperToken</span>
          <input
            class="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
            :value="
              currentBackend
                ? `${currentBackend.name} / ${maskToken(currentBackend.token)}`
                : '未选择'
            "
            disabled
          />
        </label>
        <div class="flex flex-wrap items-end gap-2">
          <button
            class="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-opacity disabled:pointer-events-none disabled:opacity-50"
            type="button"
            :disabled="logsPanel.isBusy.value"
            @click="startSubscription"
          >
            开始订阅
          </button>
          <button
            class="border-border bg-background hover:bg-muted inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
            type="button"
            :disabled="logsPanel.isBusy.value"
            @click="stopSubscription"
          >
            取消订阅
          </button>
          <span
            class="bg-muted text-muted-foreground inline-flex h-9 items-center rounded-md px-3 text-sm"
          >
            {{ statusLabels[logsPanel.status.value] }}
          </span>
        </div>
      </div>
      <p v-if="logsPanel.error.value" class="text-destructive mt-3 text-sm">
        {{ logsPanel.error.value }}
      </p>
    </section>

    <div class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section class="rounded-lg border p-5">
        <h2 class="font-semibold">订阅列表</h2>
        <div class="mt-4 rounded-md border p-3">
          <div class="font-mono text-xs break-all">{{ subscriptionLabel }}</div>
          <div class="text-muted-foreground mt-2 text-xs">
            log_filter: {{ logsPanel.defaultLevel.value }}
          </div>
        </div>
      </section>
      <section class="rounded-lg border p-5">
        <h2 class="font-semibold">日志推送</h2>
        <RpcDebugDataTable
          class="mt-4"
          :columns="logColumns"
          :data="logsPanel.logs.value"
          empty-text="暂无推送。订阅成功后新日志会显示在这里。"
          :row-key="(event) => event.id"
        />
      </section>
    </div>
  </div>
</template>
