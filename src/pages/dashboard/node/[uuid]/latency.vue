<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import LatencyChart from "@/components/node/latency/latency.vue";
import LatencyQualityCanvas from "@/components/node/latency/LatencyQualityCanvas.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useCronHistory } from "@/composables/useCronHistory";
import type { TaskQueryResult } from "@/composables/useCronHistory";
import {
  SERIES_COLORS,
  computeStats,
  getStableCronNames,
} from "@/components/node/latency/utils";

definePage({
  meta: {
    title: "router.node.latency",
  },
});

const route = useRoute();
const uuid = computed(() => (route.params as { uuid: string }).uuid);

const { currentBackend } = useBackendStore();
const { queryTask } = useCronHistory();

const pingLoading = ref(false);
const tcpPingLoading = ref(false);
const pingData = ref<TaskQueryResult[]>([]);
const tcpPingData = ref<TaskQueryResult[]>([]);

const pingPeakCut = ref(true);
const tcpPingPeakCut = ref(true);

const pingVisible = ref<Record<string, boolean>>({});
const tcpPingVisible = ref<Record<string, boolean>>({});
const pingHovered = ref<string | null>(null);
const tcpPingHovered = ref<string | null>(null);
const pingSeriesColors = ref<Record<string, string>>({});
const tcpPingSeriesColors = ref<Record<string, string>>({});

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

const windowMs = ref(6 * 60 * 60 * 1000);

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
const isRefreshing = computed(() => pingLoading.value || tcpPingLoading.value);
const LATENCY_QUERY_TIMEOUT_MS = 20_000;
let fetchPromise: Promise<void> | null = null;

function stopRefresh() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startRefresh() {
  stopRefresh();
  timerId = setInterval(() => {
    if (fetchPromise) return;
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

/** 合并新旧数据：task_id 去重，裁剪超出窗口的旧数据 */
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
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
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
      queryTask(
        [
          { uuid: uuid.value },
          { timestamp_from_to: [pingFrom, now] },
          { type: "ping" },
        ],
        LATENCY_QUERY_TIMEOUT_MS,
      ),
      queryTask(
        [
          { uuid: uuid.value },
          { timestamp_from_to: [tcpFrom, now] },
          { type: "tcp_ping" },
        ],
        LATENCY_QUERY_TIMEOUT_MS,
      ),
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
  })();

  try {
    await fetchPromise;
  } finally {
    fetchPromise = null;
  }
};

async function handleRefresh() {
  if (isRefreshing.value) return;
  pingData.value = [];
  tcpPingData.value = [];
  await fetchData();
}

function assignSeriesColors(
  names: string[],
  currentMap: Record<string, string>,
): Record<string, string> {
  const next = { ...currentMap };
  const usedColors = new Set(Object.values(next));

  for (const name of names) {
    if (next[name]) continue;

    const unusedColor = SERIES_COLORS.find((color) => !usedColors.has(color));
    const color =
      unusedColor ??
      SERIES_COLORS[Math.floor(Math.random() * SERIES_COLORS.length)]!;

    next[name] = color;
    usedColors.add(color);
  }

  return next;
}

watch(
  pingData,
  (data) => {
    const names = getStableCronNames(data);
    pingSeriesColors.value = assignSeriesColors(names, pingSeriesColors.value);
  },
  { immediate: true },
);

watch(
  tcpPingData,
  (data) => {
    const names = getStableCronNames(data);
    tcpPingSeriesColors.value = assignSeriesColors(
      names,
      tcpPingSeriesColors.value,
    );
  },
  { immediate: true },
);

const pingStats = computed(() =>
  computeStats(pingData.value, "ping", pingSeriesColors.value),
);
const tcpPingStats = computed(() =>
  computeStats(tcpPingData.value, "tcp_ping", tcpPingSeriesColors.value),
);

// 系列数量变化时扩展 visible 字典，保留已有隐藏状态
watch(
  pingStats,
  (stats) => {
    const next: Record<string, boolean> = {};
    for (const s of stats) next[s.name] = pingVisible.value[s.name] ?? true;
    pingVisible.value = next;
  },
  { immediate: true },
);
watch(
  tcpPingStats,
  (stats) => {
    const next: Record<string, boolean> = {};
    for (const s of stats) next[s.name] = tcpPingVisible.value[s.name] ?? true;
    tcpPingVisible.value = next;
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
        <div class="flex items-center gap-3">
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
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            :disabled="isRefreshing"
            @click="handleRefresh"
          >
            <RefreshCw
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': isRefreshing }"
            />
            刷新
          </Button>
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
            :peak-cut="tcpPingPeakCut"
            :visible-series="tcpPingVisible"
            :hovered-series="tcpPingHovered"
            :series-colors="tcpPingSeriesColors"
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
            <div class="flex items-center min-w-0 flex-1 mr-4">
              <span class="flex-1">来源</span>
              <span class="w-1/3 shrink-0 text-left">质量</span>
            </div>
            <div class="flex">
              <span class="w-20 text-right">平均延迟</span>
              <span class="w-16 text-right">抖动</span>
              <span class="w-14 text-right">丢包率</span>
            </div>
          </div>
          <div class="px-2 pb-2">
            <div
              v-for="s in tcpPingStats"
              :key="s.name"
              class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted"
              :class="
                tcpPingVisible[s.name] === false ? 'opacity-35' : 'opacity-100'
              "
              @mouseenter="
                tcpPingHovered =
                  tcpPingVisible[s.name] === false ? null : s.name
              "
              @mouseleave="tcpPingHovered = null"
              @click="tcpPingVisible[s.name] = !tcpPingVisible[s.name]"
            >
              <div class="flex items-center min-w-0 flex-1 mr-4 gap-4">
                <span class="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    class="inline-block h-0.5 rounded-full shrink-0 transition-all"
                    :class="tcpPingHovered === s.name ? 'w-7' : 'w-5'"
                    :style="{ background: s.color }"
                  />
                  <span class="truncate text-foreground">{{ s.name }}</span>
                </span>
                <span class="w-1/3 shrink-0">
                  <LatencyQualityCanvas :bars="s.qualityBars" />
                </span>
              </div>
              <div class="flex shrink-0">
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
            :hovered-series="pingHovered"
            :series-colors="pingSeriesColors"
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
            <div class="flex items-center min-w-0 flex-1 mr-4">
              <span class="flex-1">来源</span>
              <span class="w-1/3 shrink-0 text-left">质量</span>
            </div>
            <div class="flex">
              <span class="w-20 text-right">平均延迟</span>
              <span class="w-16 text-right">抖动</span>
              <span class="w-14 text-right">丢包率</span>
            </div>
          </div>
          <div class="px-2 pb-2">
            <div
              v-for="s in pingStats"
              :key="s.name"
              class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted"
              :class="
                pingVisible[s.name] === false ? 'opacity-35' : 'opacity-100'
              "
              @mouseenter="
                pingHovered = pingVisible[s.name] === false ? null : s.name
              "
              @mouseleave="pingHovered = null"
              @click="pingVisible[s.name] = !pingVisible[s.name]"
            >
              <div class="flex items-center min-w-0 flex-1 mr-4 gap-4">
                <span class="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    class="inline-block h-0.5 rounded-full shrink-0 transition-all"
                    :class="pingHovered === s.name ? 'w-7' : 'w-5'"
                    :style="{ background: s.color }"
                  />
                  <span class="truncate text-foreground">{{ s.name }}</span>
                </span>
                <span class="w-1/3 shrink-0">
                  <LatencyQualityCanvas :bars="s.qualityBars" />
                </span>
              </div>
              <div class="flex shrink-0">
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
