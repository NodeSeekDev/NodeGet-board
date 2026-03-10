<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { usePingTask } from "./usePingTask";
import { type ISP, ISP_LABELS } from "@/data/pingNodes";
import { Button } from "@/components/ui/button";
import PingChinaMapNative from "./PingChinaMapNative.vue";
import PingHistogram from "./PingHistogram.vue";
import PingResultTable from "./PingResultTable.vue";

const props = defineProps<{ uuid: string }>();

const { currentBackend } = useBackendStore();

const url = computed(() => currentBackend.value?.url ?? "");
const token = computed(() => currentBackend.value?.token ?? "");

const testType = ref<"ping" | "tcp_ping">("tcp_ping");
const ispFilter = ref<ISP | "all">("all");
const concurrency = ref(5);
const delayBeforeQueryMs = ref(400);
const loopCount = ref(20);

const { results, pingStatus, start, stop } = usePingTask(
  props.uuid,
  url.value,
  token.value,
);

function runOnce() {
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

watch(pingStatus, (val) => {
  if (val !== "running") isContinuousRunning.value = false;
});

const completedCount = computed(
  () =>
    results.value.filter((r) => r.status === "success" || r.status === "failed")
      .length,
);
</script>

<template>
  <div class="space-y-6">
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

      <div class="flex items-center gap-2 text-sm">
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
      </div>

      <div class="flex items-center gap-2 ml-auto">
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

    <!-- 地图 + 直方图 -->
    <div class="flex gap-4">
      <div class="shrink-0 border rounded-lg bg-card p-2" style="width: 450px">
        <PingChinaMapNative :results="results" :isp-filter="ispFilter" />
      </div>

      <!-- 直方图 -->
      <div
        class="flex-1 min-w-0 border rounded-lg bg-card p-2"
        style="height: 416px"
      >
        <PingHistogram :results="results" />
      </div>
    </div>

    <!-- 结果表格 -->
    <div>
      <PingResultTable :results="results" :loop-count="loopCount" />
    </div>
  </div>
</template>
