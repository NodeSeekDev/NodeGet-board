<script setup lang="ts">
import { ref, computed } from "vue";
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

const testType = ref<"ping" | "tcp_ping">("ping");
const ispFilter = ref<ISP | "all">("all");

const { results, pingStatus, start, stop } = usePingTask(
  props.uuid,
  url.value,
  token.value,
);

function runOnce() {
  start(testType.value, ispFilter.value, false);
}

function runContinuous() {
  start(testType.value, ispFilter.value, true);
}

const LATENCY_LEGEND = [
  { label: "未测", color: "#e5e7eb" },
  { label: "≤50ms", color: "#26a91e" },
  { label: "51-100ms", color: "#43dd3e" },
  { label: "101-200ms", color: "#bef663" },
  { label: "201-250ms", color: "#f6ed44" },
  { label: ">250ms", color: "#f69833" },
  { label: "超时", color: "#e6170f" },
];

const completedCount = computed(
  () =>
    results.value.filter((r) => r.status === "success" || r.status === "failed")
      .length,
);
</script>

<template>
  <div class="space-y-6">
    <!-- 控制栏 -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- 测试类型 -->
      <div class="flex rounded-md border overflow-hidden">
        <button
          v-for="t in [
            { id: 'ping', label: 'Ping' },
            { id: 'tcp_ping', label: 'TCP Ping' },
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

      <!-- 运营商过滤 -->
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
          variant="outline"
          :disabled="pingStatus === 'running'"
          @click="runContinuous"
        >
          持续测试
        </Button>
        <Button
          v-if="pingStatus === 'running'"
          size="sm"
          variant="destructive"
          @click="stop"
        >
          停止
        </Button>
      </div>
    </div>

    <!-- 进度提示 -->
    <div class="text-sm text-muted-foreground">
      <span v-if="pingStatus === 'running'">
        测试中… {{ completedCount }} / {{ results.length }} 节点完成
      </span>
      <span v-else-if="pingStatus === 'done'">
        测试完成：{{ completedCount }} / {{ results.length }} 节点
      </span>
      <span v-else class="italic">点击「单次测试」或「持续测试」开始</span>
    </div>

    <!-- 地图 + 直方图 -->
    <div class="flex gap-4">
      <div class="shrink-0 border rounded-lg bg-card p-2" style="width: 450px">
        <PingChinaMapNative :results="results" :isp-filter="ispFilter" />
      </div>

      <!-- 直方图（自动填充剩余宽度，高度与地图一致） -->
      <div
        class="flex-1 min-w-0 border rounded-lg bg-card p-2"
        style="height: 416px"
      >
        <PingHistogram :results="results" />
      </div>
    </div>

    <!-- 结果表格 -->
    <div>
      <PingResultTable :results="results" />
    </div>
  </div>
</template>
