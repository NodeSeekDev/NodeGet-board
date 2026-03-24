<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import LatencyChart from "@/components/node/latency/latency.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useCronHistory } from "@/composables/useCronHistory";
import type { TaskQueryResult } from "@/composables/useCronHistory";

const route = useRoute();
const uuid = computed(() => route.params.uuid as string);

const { currentBackend } = useBackendStore();
const { queryTask } = useCronHistory();

const pingLoading = ref(false);
const tcpPingLoading = ref(false);
const pingData = ref<TaskQueryResult[]>([]);
const tcpPingData = ref<TaskQueryResult[]>([]);

// ── 刷新间隔 ──────────────────────────────────────────────
const INTERVALS = [
  { label: "5s", value: 5_000 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
] as const;

const refreshInterval = ref(10_000);
let timerId: ReturnType<typeof setInterval> | null = null;

function stopRefresh() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startRefresh() {
  stopRefresh();
  timerId = setInterval(() => {
    void fetchData();
  }, refreshInterval.value);
}

function setInterval_(interval: number) {
  refreshInterval.value = interval;
  // 切换后重置计时器，等待新间隔后再请求
  startRefresh();
}

onUnmounted(stopRefresh);
// ─────────────────────────────────────────────────────────

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** 取数据集中最大的 timestamp（ms） */
function latestTs(data: TaskQueryResult[]): number | null {
  if (!data.length) return null;
  return data.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), 0);
}

/** 合并新旧数据：task_id 去重，裁剪超出 24h 窗口的旧数据 */
function mergeAndTrim(
  existing: TaskQueryResult[],
  incoming: TaskQueryResult[],
  cutoff: number,
): TaskQueryResult[] {
  const map = new Map<number, TaskQueryResult>();
  for (const r of existing) if (r.timestamp >= cutoff) map.set(r.task_id, r);
  for (const r of incoming) if (r.timestamp >= cutoff) map.set(r.task_id, r);
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const fetchData = async () => {
  if (!uuid.value || !currentBackend.value?.url) {
    pingData.value = [];
    tcpPingData.value = [];
    return;
  }

  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // 有已有数据时从最新时间戳开始增量拉取，否则全量查 24h
  const pingFrom = latestTs(pingData.value) ?? cutoff;
  const tcpFrom = latestTs(tcpPingData.value) ?? cutoff;

  pingLoading.value = true;
  tcpPingLoading.value = true;

  const [pingResult, tcpResult] = await Promise.allSettled([
    queryTask([
      { uuid: uuid.value },
      { timestamp_from_to: [pingFrom, now] },
      { type: "ping" },
    ]),
    queryTask([
      { uuid: uuid.value },
      { timestamp_from_to: [tcpFrom, now] },
      { type: "tcp_ping" },
    ]),
  ]);

  pingLoading.value = false;
  tcpPingLoading.value = false;

  if (pingResult.status === "fulfilled") {
    const incoming = Array.isArray(pingResult.value) ? pingResult.value : [];
    pingData.value = mergeAndTrim(pingData.value, incoming, cutoff);
  } else {
    toast.error(
      `ping 查询失败：${pingResult.reason instanceof Error ? pingResult.reason.message : String(pingResult.reason)}`,
    );
  }

  if (tcpResult.status === "fulfilled") {
    const incoming = Array.isArray(tcpResult.value) ? tcpResult.value : [];
    tcpPingData.value = mergeAndTrim(tcpPingData.value, incoming, cutoff);
  } else {
    toast.error(
      `tcp_ping 查询失败：${tcpResult.reason instanceof Error ? tcpResult.reason.message : String(tcpResult.reason)}`,
    );
  }
};

// backend / uuid 变化时：立即拉一次数据，并重启自动刷新
watch(
  () => [currentBackend.value?.url, currentBackend.value?.token, uuid.value],
  () => {
    void fetchData();
    startRefresh();
  },
  { immediate: true },
);
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="flex flex-col gap-4 p-4">
      <!-- 顶部控制栏 -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">最近 24 小时</span>
        <!-- 刷新间隔按钮组 -->
        <div class="inline-flex rounded-md border overflow-hidden text-xs">
          <button
            v-for="item in INTERVALS"
            :key="item.value"
            class="px-3 py-1.5 transition-colors"
            :class="
              refreshInterval === item.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-card text-muted-foreground hover:bg-muted'
            "
            @click="setInterval_(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <!-- TCP Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <span class="text-sm font-semibold">TCP Ping</span>
        </div>
        <div class="relative h-[260px]">
          <!-- 首次加载（无数据）时展示 spinner -->
          <div
            v-if="tcpPingLoading && tcpPingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <!-- 无数据且不在加载 -->
          <div
            v-else-if="!tcpPingLoading && tcpPingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无 tcp_ping 数据
          </div>
          <!-- 有数据时始终保持挂载，刷新时不卸载 -->
          <LatencyChart
            v-if="tcpPingData.length > 0"
            :data="tcpPingData"
            type="tcp_ping"
            class="w-full h-full"
          />
          <!-- 刷新中：轻量覆盖指示，不遮挡图表 -->
          <div
            v-if="tcpPingLoading && tcpPingData.length > 0"
            class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
      </div>

      <!-- Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <span class="text-sm font-semibold">Ping</span>
        </div>
        <div class="relative h-[260px]">
          <div
            v-if="pingLoading && pingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <div
            v-else-if="!pingLoading && pingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无 ping 数据
          </div>
          <LatencyChart
            v-if="pingData.length > 0"
            :data="pingData"
            type="ping"
            class="w-full h-full"
          />
          <div
            v-if="pingLoading && pingData.length > 0"
            class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
      </div>
    </div>
  </div>
</template>
