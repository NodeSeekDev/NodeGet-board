<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useBackendStore } from "@/composables/useBackendStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type RpcDebugRecord, useRpcDebugStore } from "./rpcDebugStore";
import { rpcDebugTabs } from "./helpers";
import type { RpcDebugTabKey } from "./types";
import RpcAuthView from "./components/RpcAuthView.vue";
import RpcComposerView from "./components/RpcComposerView.vue";
import RpcNetworkView from "./components/RpcNetworkView.vue";
import RpcSettingsView from "./components/RpcSettingsView.vue";
import RpcStreamsView from "./components/RpcStreamsView.vue";

const activeTab = ref<RpcDebugTabKey>("network");
const pendingComposerRecord = ref<RpcDebugRecord | null>(null);

const debugStore = useRpcDebugStore();
const backendStore = useBackendStore();

const connectionLabel = computed(() => {
  const backend = backendStore.currentBackend.value;
  return backend?.url || "未选择后端";
});

const latencyLabel = computed(() => {
  const latest = [...debugStore.records.value]
    .reverse()
    .find((record) => typeof record.durationMs === "number");
  return latest?.durationMs != null ? `${latest.durationMs}ms` : "--";
});

async function copyText(text: string, message = "已复制") {
  await navigator.clipboard.writeText(text);
  toast.success(message);
}

function handleRecordEdit(record: RpcDebugRecord) {
  pendingComposerRecord.value = record;
  activeTab.value = "composer";
}

function handleComposerSourceOpen(recordId: string) {
  debugStore.selectedRecordId.value = recordId;
  activeTab.value = "network";
}
</script>

<template>
  <Card
    class="h-full max-h-full gap-0 overflow-hidden rounded-lg bg-background py-0"
  >
    <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col gap-0">
      <header
        class="flex min-h-12 flex-none items-center justify-between gap-3 border-b px-4 py-1.5"
      >
        <TabsList class="h-8 shrink-0 rounded-md bg-muted/60 p-0.5">
          <TabsTrigger
            v-for="tab in rpcDebugTabs"
            :key="tab.key"
            :value="tab.key"
            class="h-7 flex-none px-2.5 text-xs text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <div class="flex min-w-0 flex-none flex-col items-end gap-0.5">
          <div class="flex min-w-0 items-center gap-1.5">
            <div class="shrink-0 text-sm leading-none font-semibold">
              NodeGet RPC 调试
            </div>
            <Badge
              :variant="
                debugStore.activeConnectionCount.value > 0
                  ? 'default'
                  : 'destructive'
              "
              class="h-5 rounded-md px-2 text-[11px] leading-none"
            >
              WS
              {{ debugStore.activeConnectionCount.value > 0 ? "就绪" : "断开" }}
            </Badge>
            <Badge
              variant="secondary"
              class="h-5 rounded-md px-2 text-[11px] leading-none"
            >
              {{ latencyLabel }}
            </Badge>
          </div>
          <span
            class="max-w-md truncate text-[11px] leading-none text-muted-foreground"
          >
            {{ connectionLabel }}
          </span>
        </div>
      </header>

      <CardContent class="inset-0 flex min-h-0 flex-auto overflow-hidden p-0">
        <TabsContent
          :value="activeTab"
          class="m-0 h-full w-full overflow-hidden p-0"
        >
          <!-- 配合 KeepAlive 缓存内部切换的各个业务子组件 -->
          <KeepAlive>
            <RpcNetworkView
              v-if="activeTab === 'network'"
              @copy="copyText"
              @edit-record="handleRecordEdit"
            />

            <RpcComposerView
              v-else-if="activeTab === 'composer'"
              :pending-record="pendingComposerRecord"
              @copied="(message) => toast.success(message || '已复制')"
              @consumed-record="pendingComposerRecord = null"
              @show-source-record="handleComposerSourceOpen"
            />

            <RpcStreamsView v-else-if="activeTab === 'subscription'" />

            <RpcAuthView v-else-if="activeTab === 'auth'" @copy="copyText" />

            <RpcSettingsView v-else-if="activeTab === 'settings'" />
          </KeepAlive>
        </TabsContent>
      </CardContent>
    </Tabs>
  </Card>
</template>
