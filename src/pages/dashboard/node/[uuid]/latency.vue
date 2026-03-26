<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import LatencyChart from "@/components/node/latency/latency.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useCronHistory } from "@/composables/useCronHistory";
import type { TaskQueryResult } from "@/composables/useCronHistory";
import {
  computeStats,
  type SeriesStats,
} from "@/components/node/latency/utils";

definePage({
  meta: {
    title: "router.node.latency",
  },
});

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

const pingVisible = ref<Record<string, boolean>>({});
const tcpPingVisible = ref<Record<string, boolean>>({});

const WINDOWS = [
  { label: "7天", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1天", value: 24 * 60 * 60 * 1000 },
  { label: "12小时", value: 12 * 60 * 60 * 1000 },
  { label: "6小时", value: 6 * 60 * 60 * 1000 },
  { label: "1小时", value: 60 * 60 * 1000 },
  { label: "30分钟", value: 30 * 60 * 60 * 1000 },
  { label: "5分钟", value: 5 * 60 * 60 * 1000 },
] as const;

const windowMs = ref(60 * 60 * 1000);

watch(windowMs, () => {
  pingData.value = [];
  tcpPingData.value = [];
  void fetchData();
});

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

watch(refreshInterval, startRefresh);

onUnmounted(stopRefresh);

function latestTs(data: TaskQueryResult[]): number | null {
  if (!data.length) return null;
  return data.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), 0);
}

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
          <div
            v-if="tcpPingLoading && tcpPingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <div
            v-else-if="!tcpPingLoading && tcpPingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无 tcp_ping 数据
          </div>

          <LatencyChart
            v-if="tcpPingData.length > 0"
            :rows="tcpPingData"
            type="tcp_ping"
            :cut-peak="tcpPingPeakCut"
            :visible-map="tcpPingVisible"
          />
        </div>

        <div
          v-if="tcpPingStats.length"
          class="px-4 py-3 border-t grid gap-2 md:grid-cols-2 xl:grid-cols-4"
        >
          <div
            v-for="s in tcpPingStats"
            :key="s.name"
            class="rounded-md border px-3 py-2 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 cursor-pointer min-w-0">
                <input
                  v-model="tcpPingVisible[s.name]"
                  type="checkbox"
                  class="accent-primary w-3.5 h-3.5 shrink-0"
                />
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: s.color }"
                />
                <span class="font-medium truncate" :title="s.name">
                  {{ s.name }}
                </span>
              </label>
              <span class="text-[10px] text-muted-foreground">
                丢包 {{ s.lossRate.toFixed(1) }}%
              </span>
            </div>
            <div class="mt-1.5 text-muted-foreground leading-5">
              平均:
              <span class="text-foreground">
                {{ s.avg == null ? "-" : `${s.avg.toFixed(0)} ms` }}
              </span>
              <br />
              抖动:
              <span class="text-foreground">
                {{ s.jitter == null ? "-" : `${s.jitter.toFixed(0)} ms` }}
              </span>
            </div>
          </div>
        </div>
      </div>

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
            :rows="pingData"
            type="ping"
            :cut-peak="pingPeakCut"
            :visible-map="pingVisible"
          />
        </div>

        <div
          v-if="pingStats.length"
          class="px-4 py-3 border-t grid gap-2 md:grid-cols-2 xl:grid-cols-4"
        >
          <div
            v-for="s in pingStats"
            :key="s.name"
            class="rounded-md border px-3 py-2 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 cursor-pointer min-w-0">
                <input
                  v-model="pingVisible[s.name]"
                  type="checkbox"
                  class="accent-primary w-3.5 h-3.5 shrink-0"
                />
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: s.color }"
                />
                <span class="font-medium truncate" :title="s.name">
                  {{ s.name }}
                </span>
              </label>
              <span class="text-[10px] text-muted-foreground">
                丢包 {{ s.lossRate.toFixed(1) }}%
              </span>
            </div>
            <div class="mt-1.5 text-muted-foreground leading-5">
              平均:
              <span class="text-foreground">
                {{ s.avg == null ? "-" : `${s.avg.toFixed(0)} ms` }}
              </span>
              <br />
              抖动:
              <span class="text-foreground">
                {{ s.jitter == null ? "-" : `${s.jitter.toFixed(0)} ms` }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
