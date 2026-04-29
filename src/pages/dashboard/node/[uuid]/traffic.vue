<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { formatBytes } from "@/utils/format";
import TrafficBarChart, {
  type TrafficBucket,
} from "@/components/node/traffic/TrafficBarChart.vue";

definePage({ meta: { title: "router.node.traffic" } });

const route = useRoute();
const uuid = computed(() => (route.params as { uuid: string }).uuid);
const { currentBackend } = useBackendStore();

type SummaryPoint = {
  timestamp: number;
  total_received?: number;
  total_transmitted?: number;
};

async function querySummary(
  url: string,
  token: string,
  uuid: string,
  from: number,
  to: number,
): Promise<SummaryPoint[]> {
  return getWsConnection(url).call<SummaryPoint[]>(
    "agent_query_dynamic_summary",
    [
      token,
      {
        fields: ["total_received", "total_transmitted"],
        condition: [{ uuid }, { timestamp_from_to: [from, to] }, { limit: 5 }],
      },
    ],
  );
}

type ScopeKey = "minute" | "hour" | "day" | "week";

const SCOPES: {
  key: ScopeKey;
  label: string;
  buckets: number;
  bucketMs: number;
  tolerance: number;
}[] = [
  {
    key: "minute",
    label: "每分钟",
    buckets: 60,
    bucketMs: 60 * 1000,
    tolerance: 30 * 1000,
  },
  {
    key: "hour",
    label: "每小时",
    buckets: 24,
    bucketMs: 60 * 60 * 1000,
    tolerance: 5 * 60 * 1000,
  },
  {
    key: "day",
    label: "每天",
    buckets: 7,
    bucketMs: 24 * 60 * 60 * 1000,
    tolerance: 30 * 60 * 1000,
  },
  {
    key: "week",
    label: "每周",
    buckets: 4,
    bucketMs: 7 * 24 * 60 * 60 * 1000,
    tolerance: 6 * 60 * 60 * 1000,
  },
];

const INTERVALS = [
  { label: "30秒", value: 30_000 },
  { label: "1分钟", value: 60_000 },
  { label: "5分钟", value: 5 * 60_000 },
] as const;

const scopeKey = ref<ScopeKey>("hour");
const scope = computed(
  () => SCOPES.find((s) => s.key === scopeKey.value) ?? SCOPES[0]!,
);
const refreshInterval = ref(60_000);

const buckets = ref<TrafficBucket[]>([]);
const loading = ref(false);
const visibleSeries = ref({ rx: true, tx: true, total: true });
const hovered = ref<"rx" | "tx" | "total" | null>(null);

let timerId: ReturnType<typeof setInterval> | null = null;
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

function labelOf(ts: number, key: ScopeKey) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (key === "minute") return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (key === "hour") return `${pad(d.getHours())}:00`;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

const fetchData = async () => {
  if (fetchPromise) return fetchPromise;
  const backend = currentBackend.value;
  if (!uuid.value || !backend?.url) return;

  fetchPromise = (async () => {
    loading.value = true;
    try {
      const s = scope.value;
      const now = Date.now();

      const bounds: number[] = [];
      for (let i = 0; i <= s.buckets; i++) {
        bounds.push(now - (s.buckets - i) * s.bucketMs);
      }

      const points = await Promise.all(
        bounds.map(async (t) => {
          try {
            const arr = await querySummary(
              backend.url,
              backend.token,
              uuid.value,
              t - s.tolerance,
              t + s.tolerance,
            );
            if (!Array.isArray(arr) || arr.length === 0) return null;
            let best = arr[0]!;
            for (const r of arr) {
              if (Math.abs(r.timestamp - t) < Math.abs(best.timestamp - t))
                best = r;
            }
            return best;
          } catch {
            return null;
          }
        }),
      );

      const next: TrafficBucket[] = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const ts = bounds[i]!;
        if (!start || !end) {
          next.push({ label: labelOf(ts, s.key), rx: 0, tx: 0, total: 0 });
          continue;
        }
        const rx = Math.max(
          0,
          (end.total_received ?? 0) - (start.total_received ?? 0),
        );
        const tx = Math.max(
          0,
          (end.total_transmitted ?? 0) - (start.total_transmitted ?? 0),
        );
        next.push({ label: labelOf(ts, s.key), rx, tx, total: rx + tx });
      }
      buckets.value = next;
    } catch (e) {
      toast.error(
        `流量查询失败：${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      loading.value = false;
    }
  })();

  try {
    await fetchPromise;
  } finally {
    fetchPromise = null;
  }
};

watch(scopeKey, () => {
  buckets.value = [];
  void fetchData();
});

watch(refreshInterval, startRefresh);

watch(
  () => [currentBackend.value?.url, currentBackend.value?.token, uuid.value],
  () => {
    void fetchData();
    startRefresh();
  },
  { immediate: true },
);

onUnmounted(stopRefresh);

const totals = computed(() =>
  buckets.value.reduce(
    (acc, b) => ({
      rx: acc.rx + b.rx,
      tx: acc.tx + b.tx,
      total: acc.total + b.total,
    }),
    { rx: 0, tx: 0, total: 0 },
  ),
);

const SERIES = [
  { key: "rx", name: "入", color: "#3b82f6" },
  { key: "tx", name: "出", color: "#22c55e" },
  { key: "total", name: "合计", color: "#8b5cf6" },
] as const;
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span
            class="text-xs text-muted-foreground inline-flex items-center gap-1"
          >
            粒度
            <select
              v-model="scopeKey"
              class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
            >
              <option v-for="s in SCOPES" :key="s.key" :value="s.key">
                {{ s.label }}
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
              <option v-for="i in INTERVALS" :key="i.value" :value="i.value">
                {{ i.label }}
              </option>
            </select>
            更新
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 px-2 text-xs"
          :disabled="loading"
          @click="fetchData"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
      </div>

      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <span class="text-sm font-semibold">{{ scope.label }}</span>
        </div>
        <div class="relative h-[280px]">
          <div
            v-if="loading && !buckets.length"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <div
            v-else-if="!loading && !buckets.length"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无流量数据
          </div>
          <TrafficBarChart
            v-if="buckets.length"
            :data="buckets"
            :visible-series="visibleSeries"
            class="w-full h-full"
          />
          <div
            v-if="loading && buckets.length"
            class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
          />
        </div>
        <div v-if="buckets.length" class="border-t px-2 py-2">
          <div
            v-for="s in SERIES"
            :key="s.key"
            class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted"
            :class="!visibleSeries[s.key] ? 'opacity-35' : 'opacity-100'"
            @mouseenter="hovered = visibleSeries[s.key] ? s.key : null"
            @mouseleave="hovered = null"
            @click="visibleSeries[s.key] = !visibleSeries[s.key]"
          >
            <span class="flex items-center gap-2 min-w-0 flex-1">
              <span
                class="inline-block h-0.5 rounded-full shrink-0 transition-all"
                :class="hovered === s.key ? 'w-7' : 'w-5'"
                :style="{ background: s.color }"
              />
              <span class="text-foreground">{{ s.name }}</span>
            </span>
            <span class="text-right tabular-nums text-foreground">
              {{ formatBytes(totals[s.key]) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
