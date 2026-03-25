<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import LatencyChart from "@/components/node/latency/latency.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useCronHistory } from "@/composables/useCronHistory";
import type { TaskQueryResult } from "@/composables/useCronHistory";

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

type SeriesStats = {
  name: string;
  color: string;
  avg: number | null;
  jitter: number | null;
  lossRate: number;
};

function computeStats(
  data: TaskQueryResult[],
  type: "ping" | "tcp_ping",
): SeriesStats[] {
  const cronNames = [...new Set(data.map((r) => r.cron_source ?? "未知"))];
  return cronNames
    .map((name) => {
      const colorIndex = cronNames.indexOf(name);
      const rows = data.filter((r) => (r.cron_source ?? "未知") === name);
      const total = rows.length;
      const color = CHART_COLORS[colorIndex % CHART_COLORS.length]!;
      if (total === 0)
        return { name, color, avg: null, jitter: null, lossRate: 0 };

      const vals = rows
        .filter(
          (r) =>
            r.success &&
            r.task_event_result &&
            typeof r.task_event_result[type] === "number",
        )
        .map((r) => r.task_event_result![type] as number);

      const lossRate = ((total - vals.length) / total) * 100;
      if (vals.length === 0)
        return { name, color, avg: null, jitter: null, lossRate };

      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const jitter =
        vals.length >= 2
          ? vals.slice(1).reduce((s, v, i) => s + Math.abs(v - vals[i]!), 0) /
            (vals.length - 1)
          : null;

      return { name, color, avg, jitter, lossRate };
    })
    .sort((a, b) => {
      const avgA = a.avg ?? Infinity;
      const avgB = b.avg ?? Infinity;
      if (avgA !== avgB) return avgA - avgB;
      const jitterA = a.jitter ?? Infinity;
      const jitterB = b.jitter ?? Infinity;
      if (jitterA !== jitterB) return jitterA - jitterB;
      return a.lossRate - b.lossRate;
    });
}

const route = useRoute();
const uuid = computed(() => route.params.uuid as string);

const { currentBackend } = useBackendStore();
const { queryTask } = useCronHistory();

const pingLoading = ref(false);
const tcpPingLoading = ref(false);
const pingData = ref<TaskQueryResult[]>([]);
const tcpPingData = ref<TaskQueryResult[]>([]);

const pingPeakCut = ref(true);
const tcpPingPeakCut = ref(true);

const pingVisible = ref<boolean[]>([]);
const tcpPingVisible = ref<boolean[]>([]);

// ── 时间窗口 ──────────────────────────────────────────────
const WINDOWS = [
  { label: "7天", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1天", value: 24 * 60 * 60 * 1000 },
  { label: "12小时", value: 12 * 60 * 60 * 1000 },
  { label: "6小时", value: 6 * 60 * 60 * 1000 },
  { label: "1小时", value: 60 * 60 * 1000 },
  { label: "30分钟", value: 30 * 60 * 1000 },
  { label: "5分钟", value: 5 * 60 * 1000 },
] as const;

const windowMs = ref(60 * 60 * 1000);

// 窗口切换时清空旧数据，触发全量重新拉取
watch(windowMs, () => {
  pingData.value = [];
  tcpPingData.value = [];
  void fetchData();
});
// ─────────────────────────────────────────────────────────

// ── 刷新间隔 ──────────────────────────────────────────────
const INTERVALS = [
  { label: "5秒", value: 5_000 },
  { label: "10秒", value: 10_000 },
  { label: "30秒", value: 30_000 },
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

// 间隔切换时重置计时器
watch(refreshInterval, startRefresh);

onUnmounted(stopRefresh);
// ─────────────────────────────────────────────────────────

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
  const cutoff = now - windowMs.value;

  // 有已有数据时从最新时间戳开始增量拉取，否则全量查所选时间窗口
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

const pingStats = computed(() => computeStats(pingData.value, "ping"));
const tcpPingStats = computed(() =>
  computeStats(tcpPingData.value, "tcp_ping"),
);

// 系列数量变化时扩展 visible 数组，保留已有隐藏状态
watch(
  pingStats,
  (stats) => {
    pingVisible.value = stats.map((_, i) => pingVisible.value[i] ?? true);
  },
  { immediate: true },
);
watch(
  tcpPingStats,
  (stats) => {
    tcpPingVisible.value = stats.map((_, i) => tcpPingVisible.value[i] ?? true);
  },
  { immediate: true },
);

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
    <div class="flex flex-col gap-4">
      <!-- 顶部控制栏 -->
      <div class="flex items-center justify-between">
        <span
          class="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          最近
          <select
            v-model="windowMs"
            class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
          >
            <option v-for="w in WINDOWS" :key="w.value" :value="w.value">
              {{ w.label }}
            </option>
          </select>
        </span>
        <span
          class="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          每
          <select
            v-model="refreshInterval"
            class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
          >
            <option
              v-for="item in INTERVALS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
          更新
        </span>
      </div>

      <!-- TCP Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <span class="text-sm font-semibold">TCP Ping</span>
          <label
            class="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground"
          >
            <input
              v-model="tcpPingPeakCut"
              type="checkbox"
              class="accent-primary w-3.5 h-3.5 cursor-pointer"
            />
            削峰
          </label>
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
            :peak-cut="tcpPingPeakCut"
            :visible-series="tcpPingVisible"
            class="w-full h-full"
          />
          <!-- 刷新中：轻量覆盖指示，不遮挡图表 -->
          <div
            v-if="tcpPingLoading && tcpPingData.length > 0"
            class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
        <!-- 统计数据 -->
        <div v-if="tcpPingStats.length > 0" class="border-t">
          <div
            class="flex items-center justify-between px-4 pt-2.5 pb-1 text-xs text-muted-foreground"
          >
            <span>来源</span>
            <div class="flex">
              <span class="w-20 text-right">平均延迟</span>
              <span class="w-16 text-right">抖动</span>
              <span class="w-14 text-right">丢包率</span>
            </div>
          </div>
          <div class="px-2 pb-2">
            <div
              v-for="(s, i) in tcpPingStats"
              :key="s.name"
              class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted"
              :class="
                tcpPingVisible[i] === false ? 'opacity-35' : 'opacity-100'
              "
              @click="tcpPingVisible[i] = !tcpPingVisible[i]"
            >
              <span class="flex items-center gap-2 min-w-0 flex-1 mr-4">
                <span
                  class="inline-block w-5 h-0.5 rounded-full flex-shrink-0"
                  :style="{ background: s.color }"
                />
                <span class="truncate text-foreground">{{ s.name }}</span>
              </span>
              <div class="flex flex-shrink-0">
                <span class="w-20 text-right tabular-nums text-foreground">
                  {{ s.avg != null ? s.avg.toFixed(1) + " ms" : "—" }}
                </span>
                <span class="w-16 text-right tabular-nums text-foreground">
                  {{ s.jitter != null ? s.jitter.toFixed(1) + " ms" : "—" }}
                </span>
                <span
                  class="w-14 text-right tabular-nums"
                  :class="
                    s.lossRate >= 5
                      ? 'text-red-500 font-medium'
                      : 'text-foreground'
                  "
                >
                  {{ s.lossRate.toFixed(1) + "%" }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <span class="text-sm font-semibold">Ping</span>
          <label
            class="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground"
          >
            <input
              v-model="pingPeakCut"
              type="checkbox"
              class="accent-primary w-3.5 h-3.5 cursor-pointer"
            />
            削峰
          </label>
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
            :peak-cut="pingPeakCut"
            :visible-series="pingVisible"
            class="w-full h-full"
          />
          <div
            v-if="pingLoading && pingData.length > 0"
            class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
        <!-- 统计数据 -->
        <div v-if="pingStats.length > 0" class="border-t">
          <div
            class="flex items-center justify-between px-4 pt-2.5 pb-1 text-xs text-muted-foreground"
          >
            <span>来源</span>
            <div class="flex">
              <span class="w-20 text-right">平均延迟</span>
              <span class="w-16 text-right">抖动</span>
              <span class="w-14 text-right">丢包率</span>
            </div>
          </div>
          <div class="px-2 pb-2">
            <div
              v-for="(s, i) in pingStats"
              :key="s.name"
              class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted"
              :class="pingVisible[i] === false ? 'opacity-35' : 'opacity-100'"
              @click="pingVisible[i] = !pingVisible[i]"
            >
              <span class="flex items-center gap-2 min-w-0 flex-1 mr-4">
                <span
                  class="inline-block w-5 h-0.5 rounded-full flex-shrink-0"
                  :style="{ background: s.color }"
                />
                <span class="truncate text-foreground">{{ s.name }}</span>
              </span>
              <div class="flex flex-shrink-0">
                <span class="w-20 text-right tabular-nums text-foreground">
                  {{ s.avg != null ? s.avg.toFixed(1) + " ms" : "—" }}
                </span>
                <span class="w-16 text-right tabular-nums text-foreground">
                  {{ s.jitter != null ? s.jitter.toFixed(1) + " ms" : "—" }}
                </span>
                <span
                  class="w-14 text-right tabular-nums"
                  :class="
                    s.lossRate >= 5
                      ? 'text-red-500 font-medium'
                      : 'text-foreground'
                  "
                >
                  {{ s.lossRate.toFixed(1) + "%" }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
