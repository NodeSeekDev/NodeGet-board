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

    const isFirstInit =
      (!oldResult || oldResult.length === 0) && newResult.length > 0;

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
      class="flex items-center justify-center space-x-2 p-4 w-full h-20"
    >
      <div class="text-center">{{ $t("dashboard.batchExec.waitToRun") }}</div>
    </div>
    <div
      v-for="node in props.result"
      :key="node.uuid"
      class="border rounded-md p-2"
    >
      <div
        class="flex flex-row gap-2 items-center cursor-pointer select-none"
        :class="expandedMap[node.uuid] ? 'border-b pb-2 mb-2' : ''"
        @click="toggleItem(node.uuid)"
      >
        <ChevronRight
          class="w-4 h-4 transition-transform duration-200"
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
        class="bg-black text-green-400 font-mono p-4 rounded overflow-auto shadow-lg max-h-[300px]"
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
