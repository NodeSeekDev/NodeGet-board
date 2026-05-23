<script setup lang="ts">
import { ref, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";

interface Node {
  uuid: string;
  name: string;
  tags?: string[];
}

interface ResultItem {
  uuid: string;
  result: string;
  status: 0 | 1 | -1;
  error: string;
}

const props = defineProps<{
  result: ResultItem[];
  nodes: Node[];
  expandedAll?: boolean;
}>();

const expandedMap = ref<Record<string, boolean>>({});

const getNodeName = (uuid: string) => {
  const node = props.nodes?.find((n) => n.uuid === uuid);
  return node?.name || "Unknown";
};

const initExpandedMap = () => {
  expandedMap.value = Object.fromEntries(
    props.result.map((item) => [item.uuid, props.expandedAll ? true : false]),
  );
};

const toggleItem = (uuid: string) => {
  expandedMap.value[uuid] = !expandedMap.value[uuid];
};

watch(
  () => props.expandedAll,
  () => {
    initExpandedMap();
  },
  { immediate: true },
);

watch(
  () => props.result,
  (newResult, oldResult) => {
    const nextMap: Record<string, boolean> = {};

    const isFirstInit = false;
    // (!oldResult || oldResult.length === 0) && newResult.length > 0;

    newResult.forEach((item, index) => {
      if (isFirstInit) {
        nextMap[item.uuid] = index === 0;
      } else if (expandedMap.value[item.uuid] !== undefined) {
        nextMap[item.uuid] = expandedMap.value[item.uuid]!;
      } else {
        nextMap[item.uuid] = props.expandedAll ? true : false;
      }
    });

    expandedMap.value = nextMap;
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="text-muted-foreground flex flex-col gap-1">
    <div
      v-if="props.result.length === 0"
      class="flex h-20 w-full items-center justify-center space-x-2 p-4"
    >
      <div class="text-center">{{ $t("dashboard.batchExec.waitToRun") }}</div>
    </div>
    <div v-for="node in props.result" :key="node.uuid" class="rounded-md border p-2">
      <div
        class="flex cursor-pointer flex-row items-center gap-2 select-none"
        :class="expandedMap[node.uuid] ? 'mb-2 border-b pb-2' : ''"
        @click="toggleItem(node.uuid)"
      >
        <ChevronRight
          class="h-4 w-4 transition-transform duration-200"
          :class="{ 'rotate-90': expandedMap[node.uuid] }"
        />
        <div>
          <div class="font-medium">
            {{ getNodeName(node.uuid) }}
            <span class="ml-1 text-xs text-gray-500">{{ node.uuid }}</span>
          </div>
        </div>
      </div>

      <pre
        v-show="expandedMap[node.uuid]"
        class="max-h-[300px] overflow-auto rounded bg-black p-4 font-mono text-green-400 shadow-lg"
        :key="`${node.uuid}-${node.status}`"
      >
        {{
          node.status === 0
            ? $t("dashboard.batchExec.pending")
            : node.status === 1
              ? node.result
              : node.error
        }}
      </pre>
    </div>
  </div>
</template>
