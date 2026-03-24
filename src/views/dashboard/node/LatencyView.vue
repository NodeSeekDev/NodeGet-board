<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

function extractLatestTarget(data: TaskQueryResult[]): string {
  if (!data.length) return "-";
  const latest = data.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
  return Object.values(latest.task_event_type)[0] ?? "-";
}

const tcpPingTargets = computed(() => extractLatestTarget(tcpPingData.value));
const pingTargets = computed(() => extractLatestTarget(pingData.value));

const fetchData = async () => {
  if (!uuid.value || !currentBackend.value?.url) {
    pingData.value = [];
    tcpPingData.value = [];
    return;
  }

  const now = Date.now();
  const from = now - 30 * 60 * 1000;

  pingLoading.value = true;
  tcpPingLoading.value = true;

  const [pingResult, tcpResult] = await Promise.allSettled([
    queryTask([
      { uuid: uuid.value },
      { timestamp_from_to: [from, now] },
      { type: "ping" },
    ]),
    queryTask([
      { uuid: uuid.value },
      { timestamp_from_to: [from, now] },
      { type: "tcp_ping" },
    ]),
  ]);

  pingLoading.value = false;
  tcpPingLoading.value = false;

  if (pingResult.status === "fulfilled") {
    pingData.value = Array.isArray(pingResult.value) ? pingResult.value : [];
  } else {
    pingData.value = [];
    toast.error(
      `ping 查询失败：${pingResult.reason instanceof Error ? pingResult.reason.message : String(pingResult.reason)}`,
    );
  }

  if (tcpResult.status === "fulfilled") {
    tcpPingData.value = Array.isArray(tcpResult.value) ? tcpResult.value : [];
  } else {
    tcpPingData.value = [];
    toast.error(
      `tcp_ping 查询失败：${tcpResult.reason instanceof Error ? tcpResult.reason.message : String(tcpResult.reason)}`,
    );
  }
};

watch(
  () => [currentBackend.value?.url, currentBackend.value?.token, uuid.value],
  () => {
    void fetchData();
  },
  { immediate: true },
);
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="flex flex-col gap-4 p-4">
      <!-- TCP Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <span class="text-sm font-semibold">TCP Ping</span>
            <span class="ml-2 text-xs text-muted-foreground">{{
              tcpPingTargets
            }}</span>
          </div>
          <span class="text-xs text-muted-foreground">最近 30 分钟</span>
        </div>
        <div class="relative h-[260px]">
          <div
            v-if="tcpPingLoading"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <div
            v-else-if="tcpPingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无 tcp_ping 数据
          </div>
          <LatencyChart
            v-else
            :data="tcpPingData"
            type="tcp_ping"
            class="w-full h-full"
          />
        </div>
      </div>

      <!-- Ping 图表 -->
      <div class="rounded-lg border bg-card">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <span class="text-sm font-semibold">Ping</span>
            <span class="ml-2 text-xs text-muted-foreground">{{
              pingTargets
            }}</span>
          </div>
          <span class="text-xs text-muted-foreground">最近 30 分钟</span>
        </div>
        <div class="relative h-[260px]">
          <div
            v-if="pingLoading"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            加载中...
          </div>
          <div
            v-else-if="pingData.length === 0"
            class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            暂无 ping 数据
          </div>
          <LatencyChart
            v-else
            :data="pingData"
            type="ping"
            class="w-full h-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>
