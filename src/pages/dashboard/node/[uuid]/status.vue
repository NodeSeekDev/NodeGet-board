<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import StatusTabBar from "@/components/node/status/StatusTabBar.vue";
import StatusCpuTab from "@/components/node/status/StatusCpuTab.vue";
import StatusMemoryTab from "@/components/node/status/StatusMemoryTab.vue";
import StatusDiskTab from "@/components/node/status/StatusDiskTab.vue";
import StatusNetworkTab from "@/components/node/status/StatusNetworkTab.vue";
import { useStatusPage } from "@/components/node/status/composables/useStatusPage";
import { MAIN_COLOR, SUB_COLOR } from "@/components/node/status/constants";

definePage({
  meta: {
    title: "router.node.status",
  },
});

const route = useRoute("/dashboard/node/[uuid]/status");
const uuid = computed(() => route.params.uuid);

const {
  server,
  notFound,
  dynamicError,
  activeTab,
  summaryWindows,
  detailWindows,
  summaries,
  details,
  selectedDisk,
  selectedIface,
  cpuSyncAxes,
  cpuZoom,
  netSyncAxes,
  netZoom,
  live,
} = useStatusPage(uuid);
</script>

<template>
  <div
    class="status-page flex h-full flex-col overflow-hidden"
    :style="{
      '--status-main-color': MAIN_COLOR,
      '--status-sub-color': SUB_COLOR,
    }"
  >
    <StatusTabBar
      v-model="activeTab"
      :live-label="live.label"
      :live-color="live.color"
      :show-live="!!server"
    />

    <div
      v-if="!server"
      class="flex flex-1 items-center justify-center text-muted-foreground"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          v-if="dynamicError"
          class="flex items-center gap-2 text-destructive"
        >
          <AlertCircle class="h-5 w-5" /> {{ dynamicError }}
        </div>
        <span v-else-if="notFound">节点未找到或已离线</span>
        <span v-else>Connecting to server...</span>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-5xl space-y-6">
        <Transition name="fade" mode="out-in">
          <StatusCpuTab
            v-if="activeTab === 'cpu'"
            key="cpu"
            :server="server"
            :summary="summaries.cpu"
            :cpu-detail="details.cpu"
            :summary-windows="summaryWindows"
            v-model:sync-axes="cpuSyncAxes"
            v-model:zoom="cpuZoom"
          />
          <StatusMemoryTab
            v-else-if="activeTab === 'memory'"
            key="memory"
            :server="server"
            :summary="summaries.memory"
            :summary-windows="summaryWindows"
          />
          <StatusDiskTab
            v-else-if="activeTab === 'disk'"
            key="disk"
            :server="server"
            :summary="summaries.disk"
            :detail="details.disk"
            :summary-windows="summaryWindows"
            :detail-windows="detailWindows"
            v-model:selected-disk="selectedDisk"
          />
          <StatusNetworkTab
            v-else-if="activeTab === 'network'"
            key="network"
            :server="server"
            :summary="summaries.network"
            :detail="details.network"
            :summary-windows="summaryWindows"
            :detail-windows="detailWindows"
            v-model:selected-iface="selectedIface"
            v-model:sync-axes="netSyncAxes"
            v-model:zoom="netZoom"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-main-text {
  color: var(--status-main-color);
}
.status-sub-text {
  color: var(--status-sub-color);
}
</style>
