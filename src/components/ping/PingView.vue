<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { usePingTask } from "./usePingTask";
import { type ISP, ISP_LABELS } from "@/data/pingNodes";
import { Button } from "@/components/ui/button";
import PingChinaMapNative from "./PingChinaMapNative.vue";
import PingHistogram from "./PingHistogram.vue";
import PingResultTable from "./PingResultTable.vue";
import { captureModules } from "@/composables/useScreenshot";

const props = defineProps<{ uuid: string }>();

const { currentBackend } = useBackendStore();

const url = computed(() => currentBackend.value?.url ?? "");
const token = computed(() => currentBackend.value?.token ?? "");

const testType = ref<"ping" | "tcp_ping">("tcp_ping");
const ispFilter = ref<ISP | "all">("all");
const selectedProvince = ref<string | null>(null);

function onProvinceClick(province: string) {
  selectedProvince.value =
    selectedProvince.value === province ? null : province;
}
const concurrency = ref(10);
const delayBeforeQueryMs = ref(400);
const loopCount = ref(20);

const { results, pingStatus, probesDone, start, stop } = usePingTask(
  props.uuid,
  url.value,
  token.value,
);

const activeLoopCount = ref(1);

function runOnce() {
  activeLoopCount.value = 1;
  start(
    testType.value,
    ispFilter.value,
    false,
    concurrency.value,
    delayBeforeQueryMs.value,
  );
}

const isContinuousRunning = ref(false);

function toggleContinuous() {
  if (isContinuousRunning.value) {
    stop();
  } else {
    isContinuousRunning.value = true;
    activeLoopCount.value = loopCount.value;
    start(
      testType.value,
      ispFilter.value,
      true,
      concurrency.value,
      delayBeforeQueryMs.value,
      loopCount.value,
    );
  }
}

// 持续时间
const elapsedSeconds = ref(0);

watch(pingStatus, (val, _old, onCleanup) => {
  if (val !== "running") isContinuousRunning.value = false;
  if (val === "running") {
    elapsedSeconds.value = 0;
    const id = setInterval(() => elapsedSeconds.value++, 1000);
    onCleanup(() => clearInterval(id));
  }
});

const elapsedDisplay = computed(() => {
  const s = elapsedSeconds.value;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
});

// 进度
const totalPings = computed(() => results.value.length * activeLoopCount.value);
const progressPercent = computed(() =>
  totalPings.value > 0
    ? Math.min(100, Math.round((probesDone.value / totalPings.value) * 100))
    : 0,
);

const mapWrapRef = ref<HTMLElement | null>(null);
const histRef = ref<HTMLElement | null>(null);
const tableRef = ref<HTMLElement | null>(null);

const shotModules = ref({ map: true, histogram: true, table: true });
const isCapturing = ref(false);

async function doScreenshot() {
  const modules = [
    { key: "map", el: mapWrapRef.value, label: "地图" },
    { key: "histogram", el: histRef.value, label: "直方图" },
    { key: "table", el: tableRef.value, label: "表格" },
  ]
    .filter(
      (m) => shotModules.value[m.key as keyof typeof shotModules.value] && m.el,
    )
    .map((m) => ({ el: m.el as HTMLElement, label: m.label }));

  if (!modules.length) return;
  isCapturing.value = true;
  try {
    await captureModules(modules);
  } finally {
    isCapturing.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 第一排：测试类型 / ISP / 参数 / 操作按钮 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex rounded-md border overflow-hidden">
        <button
          v-for="t in [
            { id: 'tcp_ping', label: 'TCP Ping' },
            { id: 'ping', label: 'Ping' },
          ]"
          :key="t.id"
          @click="testType = t.id as 'ping' | 'tcp_ping'"
          :class="[
            'px-3 py-1.5 text-sm font-medium transition-colors',
            testType === t.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          ]"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="flex rounded-md border overflow-hidden">
        <button
          v-for="isp in [
            'all',
            'telecom',
            'unicom',
            'mobile',
            'international',
          ] as const"
          :key="isp"
          @click="ispFilter = isp"
          :class="[
            'px-3 py-1.5 text-sm font-medium transition-colors',
            ispFilter === isp
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          ]"
        >
          {{ isp === "all" ? "全国" : ISP_LABELS[isp] }}
        </button>
      </div>

      <div class="flex items-center gap-2 ml-auto text-sm">
        <label class="text-muted-foreground">并发</label>
        <input
          v-model.number="concurrency"
          type="number"
          min="1"
          max="50"
          class="w-14 rounded-md border px-2 py-1.5 text-sm text-center bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label class="text-muted-foreground">延迟</label>
        <input
          v-model.number="delayBeforeQueryMs"
          type="number"
          min="0"
          step="100"
          class="w-20 rounded-md border px-2 py-1.5 text-sm text-center bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span class="text-muted-foreground">ms</span>
        <label class="text-muted-foreground ml-1">循环</label>
        <input
          v-model.number="loopCount"
          type="number"
          min="1"
          max="500"
          class="w-16 rounded-md border px-2 py-1.5 text-sm text-center bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span class="text-muted-foreground">次</span>
        <Button
          size="sm"
          variant="outline"
          :disabled="pingStatus === 'running'"
          @click="runOnce"
        >
          单次测试
        </Button>
        <Button
          size="sm"
          :variant="isContinuousRunning ? 'destructive' : 'outline'"
          :disabled="pingStatus === 'running' && !isContinuousRunning"
          @click="toggleContinuous"
        >
          {{ isContinuousRunning ? "停止测试" : "持续测试" }}
        </Button>
      </div>
    </div>

    <!-- 第二排：持续时间 / 进度 / 截图功能区 -->
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <template v-if="pingStatus !== 'idle'">
        <span class="text-muted-foreground/40 select-none">|</span>
        <span class="text-muted-foreground">时长</span>
        <span class="font-mono tabular-nums">{{ elapsedDisplay }}</span>
        <span class="text-muted-foreground/40 select-none">|</span>
        <span class="text-muted-foreground">进度</span>
        <span class="font-mono tabular-nums">
          {{ probesDone }} / {{ totalPings }}
        </span>
        <div class="flex items-center gap-1.5">
          <div class="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              class="h-full rounded-full bg-primary transition-all duration-300"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
          <span class="text-muted-foreground tabular-nums w-8 text-right"
            >{{ progressPercent }}%</span
          >
        </div>
      </template>

      <div class="flex items-center gap-2 ml-auto">
        <label
          v-for="m in [
            { key: 'map', label: '地图' },
            { key: 'histogram', label: '直方图' },
            { key: 'table', label: '表格' },
          ]"
          :key="m.key"
          class="flex items-center gap-1 text-muted-foreground cursor-pointer select-none"
        >
          <input
            type="checkbox"
            v-model="shotModules[m.key as keyof typeof shotModules]"
            class="accent-primary"
          />
          {{ m.label }}
        </label>
        <Button
          size="sm"
          variant="outline"
          :disabled="isCapturing || !Object.values(shotModules).some(Boolean)"
          @click="doScreenshot"
        >
          {{ isCapturing ? "截图中…" : "截图" }}
        </Button>
      </div>
    </div>

    <!-- 地图 + 直方图 -->
    <div class="flex gap-4">
      <div
        ref="mapWrapRef"
        class="shrink-0 border rounded-lg bg-card p-2"
        style="width: 450px"
      >
        <PingChinaMapNative
          :results="results"
          :isp-filter="ispFilter"
          :selected-province="selectedProvince"
          @province-click="onProvinceClick"
        />
      </div>

      <!-- 直方图 -->
      <div
        ref="histRef"
        class="flex-1 min-w-0 border rounded-lg bg-card p-2"
        style="height: 416px"
      >
        <PingHistogram :results="results" />
      </div>
    </div>

    <!-- 结果表格 -->
    <div ref="tableRef">
      <PingResultTable
        :results="results"
        :loop-count="loopCount"
        :province-filter="selectedProvince"
        @clear-province="selectedProvince = null"
      />
    </div>
  </div>
</template>
