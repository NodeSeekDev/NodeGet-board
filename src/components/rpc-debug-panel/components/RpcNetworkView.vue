<script setup lang="ts">
import { computed, h, ref, shallowRef } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useDebounceFn } from "@vueuse/core";
import { Download, Pause, Play, Trash2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RpcDebugRecord } from "../rpcDebugStore";
import { useRpcDebugStore } from "../rpcDebugStore";
import {
  downloadText,
  kindText,
  rpcDebugCommandFilter,
  statusClass,
  statusText,
  timeText,
} from "../helpers";
import RpcDebugDataTable from "./RpcDebugDataTable.vue";
import RpcNetworkDrawer from "./RpcNetworkDrawer.vue";

const emit = defineEmits<{
  copy: [text: string, message?: string];
  editRecord: [record: RpcDebugRecord];
}>();

const debugStore = useRpcDebugStore();
const networkFilter = ref("");
const networkFilterDraft = ref("");
const networkFilterSuggestionSnapshot = shallowRef<NetworkFilterSuggestion[]>(
  [],
);
const networkFilterSuggestionsOpen = ref(false);
const statusFilter = ref("all");
const kindFilter = ref("all");

const selectedRecord = computed(() => debugStore.selectedRecord.value);

const syncNetworkFilter = useDebounceFn(() => {
  networkFilter.value = networkFilterDraft.value;
}, 300);

type NetworkFilterSuggestionType = "method" | "id" | "keyword";

interface NetworkFilterSuggestion {
  type: NetworkFilterSuggestionType;
  value: string;
  label: string;
}

const NETWORK_FILTER_SUGGESTION_LABELS: Record<
  NetworkFilterSuggestionType,
  string
> = {
  method: "方法",
  id: "ID",
  keyword: "关键词",
};

const networkFilterSuggestionGroups = computed(() =>
  (
    Object.keys(
      NETWORK_FILTER_SUGGESTION_LABELS,
    ) as NetworkFilterSuggestionType[]
  )
    .map((type) => ({
      type,
      heading: NETWORK_FILTER_SUGGESTION_LABELS[type],
      suggestions: networkFilterSuggestionSnapshot.value.filter(
        (suggestion) => suggestion.type === type,
      ),
    }))
    .filter((group) => group.suggestions.length > 0),
);

function collectNetworkFilterSuggestions() {
  const suggestions = new Map<string, NetworkFilterSuggestion>();

  for (const record of debugStore.records.value) {
    addNetworkFilterSuggestion(suggestions, "method", record.method);
    addNetworkFilterSuggestion(suggestions, "id", record.id);
    addNetworkFilterSuggestion(suggestions, "keyword", record.subscription);
    addNetworkFilterSuggestion(suggestions, "keyword", record.note);
    addNetworkFilterSuggestion(suggestions, "keyword", record.url);
  }

  return [...suggestions.values()];
}

const filteredRecords = computed(() => {
  const q = networkFilter.value;
  return debugStore.records.value.filter((record) => {
    const searchableValues = [
      record.method,
      record.id,
      record.subscription,
      record.note,
      record.url,
    ];
    const matchesText =
      !q ||
      searchableValues.some((value) =>
        rpcDebugCommandFilter(String(value ?? ""), q),
      );
    const matchesStatus =
      statusFilter.value === "all" || record.status === statusFilter.value;
    const matchesKind =
      kindFilter.value === "all" || record.kind === kindFilter.value;
    return matchesText && matchesStatus && matchesKind;
  });
});

function addNetworkFilterSuggestion(
  suggestions: Map<string, NetworkFilterSuggestion>,
  type: NetworkFilterSuggestionType,
  value: unknown,
) {
  if (typeof value !== "string") {
    return;
  }

  const text = value.trim();
  if (!text) {
    return;
  }

  const key = `${type}:${text.toLowerCase()}`;
  if (suggestions.has(key)) {
    return;
  }

  suggestions.set(key, {
    type,
    value: text,
    label: NETWORK_FILTER_SUGGESTION_LABELS[type],
  });
}

function applyNetworkFilterSuggestion(value: string) {
  networkFilterDraft.value = value;
  networkFilter.value = value;
  closeNetworkFilterSuggestions();
}

function handleNetworkFilterInput(value: string) {
  networkFilterDraft.value = value;
  openNetworkFilterSuggestions();
  syncNetworkFilter();
}

function handleNetworkFilterFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  closeNetworkFilterSuggestions();
}

function openNetworkFilterSuggestions() {
  if (!networkFilterSuggestionsOpen.value) {
    networkFilterSuggestionSnapshot.value = collectNetworkFilterSuggestions();
  }

  networkFilterSuggestionsOpen.value = true;
}

function closeNetworkFilterSuggestions() {
  networkFilterSuggestionsOpen.value = false;
  networkFilterSuggestionSnapshot.value = [];
}

const networkColumns = computed<ColumnDef<RpcDebugRecord>[]>(() => [
  {
    id: "time",
    header: "时间",
    size: 90,
    cell: ({ row }) => timeText(row.original.startedAt),
    meta: { cellClass: "text-muted-foreground" },
  },
  {
    id: "method",
    header: "方法",
    size: 320,
    cell: ({ row }) => row.original.method,
    meta: { cellClass: "max-w-[360px] truncate font-mono text-xs" },
  },
  {
    id: "id",
    header: "ID / 订阅",
    size: 132,
    cell: ({ row }) =>
      String(row.original.id ?? row.original.subscription ?? "-"),
    meta: { cellClass: "max-w-[132px] truncate text-muted-foreground" },
  },
  {
    id: "kind",
    header: "类型",
    size: 96,
    cell: ({ row }) => kindText(row.original),
  },
  {
    id: "status",
    header: "状态",
    size: 96,
    cell: ({ row }) =>
      h(
        Badge,
        {
          variant: "outline",
          class: ["h-6 rounded px-2 text-xs", statusClass(row.original.status)],
        },
        () => statusText(row.original),
      ),
  },
  {
    id: "duration",
    header: "耗时",
    size: 84,
    cell: ({ row }) =>
      row.original.durationMs != null ? `${row.original.durationMs}ms` : "-",
    meta: { cellClass: "text-muted-foreground" },
  },
]);

function selectRecord(record: RpcDebugRecord) {
  debugStore.selectedRecordId.value = record.recordId;
}

function closeDrawer() {
  debugStore.selectedRecordId.value = null;
}

function exportRecords() {
  downloadText(
    `nodeget-rpc-debug-${Date.now()}.json`,
    debugStore.exportRecords(),
  );
}

function relayCopy(text: string, message?: string) {
  emit("copy", text, message);
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden p-4">
    <!-- 控制区 -->
    <div
      class="mb-3 flex flex-none flex-wrap items-center justify-between gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div class="relative min-w-55 flex-1 sm:max-w-[320px]">
          <Command
            :filter="rpcDebugCommandFilter"
            :highlight-on-hover="true"
            class="relative h-9 w-full overflow-visible rounded-md border bg-background shadow-none **:data-[slot=command-input]:h-8 **:data-[slot=command-input]:py-1 **:data-[slot=command-input]:text-xs **:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input-wrapper]:border-b-0 **:data-[slot=command-input-wrapper]:px-2.5"
            @focusout="handleNetworkFilterFocusOut"
          >
            <CommandInput
              v-model="networkFilterDraft"
              :auto-focus="false"
              placeholder="筛选方法 / ID / 关键词"
              @focus="openNetworkFilterSuggestions"
              @click="openNetworkFilterSuggestions"
              @update:model-value="handleNetworkFilterInput"
              @keydown.esc.stop="closeNetworkFilterSuggestions"
            />
            <CommandList
              v-if="networkFilterSuggestionsOpen"
              class="absolute top-full left-0 z-50 mt-1 max-h-64 w-full rounded-md border bg-popover shadow-md"
              @mousedown.prevent
            >
              <CommandEmpty class="py-3 text-xs"> 暂无匹配候选 </CommandEmpty>
              <CommandGroup
                v-for="group in networkFilterSuggestionGroups"
                :key="group.type"
                :heading="group.heading"
              >
                <CommandItem
                  v-for="suggestion in group.suggestions"
                  :key="`${suggestion.type}:${suggestion.value}`"
                  keep-search-on-select
                  :value="`${suggestion.type}:${suggestion.value}`"
                  class="gap-2 text-xs"
                  @select="applyNetworkFilterSuggestion(suggestion.value)"
                >
                  <Badge
                    variant="outline"
                    class="h-5 shrink-0 rounded px-1.5 text-[10px]"
                  >
                    {{ suggestion.label }}
                  </Badge>
                  <span class="min-w-0 truncate font-mono">
                    {{ suggestion.value }}
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <Select v-model="statusFilter">
          <SelectTrigger
            size="sm"
            class="h-8 w-28 bg-background px-2.5 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">等待中</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="error">错误</SelectItem>
            <SelectItem value="streaming">推送中</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="kindFilter">
          <SelectTrigger
            size="sm"
            class="h-8 w-28 bg-background px-2.5 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="call">普通调用</SelectItem>
            <SelectItem value="subscription">订阅</SelectItem>
            <SelectItem value="notification">订阅推送</SelectItem>
            <SelectItem value="raw">原始 WS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex flex-none flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs"
          type="button"
          @click="debugStore.isPaused.value = !debugStore.isPaused.value"
        >
          <Play v-if="debugStore.isPaused.value" class="size-3.5" />
          <Pause v-else class="size-3.5" />
          {{ debugStore.isPaused.value ? "继续" : "暂停" }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs"
          type="button"
          @click="debugStore.clear"
        >
          <Trash2 class="size-3.5" />
          清空
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs"
          type="button"
          @click="exportRecords"
        >
          <Download class="size-3.5" />
          导出
        </Button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="relative flex min-h-0 flex-auto overflow-hidden">
      <RpcDebugDataTable
        class="flex h-full w-full overflow-hidden"
        :columns="networkColumns"
        :data="filteredRecords"
        empty-text="暂无捕获记录。打开本页后新建的 WebSocket 请求会自动进入列表。"
        :row-key="(record) => record.recordId"
        :row-class="
          (record) =>
            selectedRecord?.recordId === record.recordId ? 'bg-muted/60' : ''
        "
        :on-row-click="selectRecord"
      />
      <RpcNetworkDrawer
        :open="!!selectedRecord"
        class="z-10"
        :record="selectedRecord"
        @close="closeDrawer"
        @copy="relayCopy"
        @edit="emit('editRecord', $event)"
      />
    </div>
  </div>
</template>
