<script setup lang="ts">
import { ref, computed } from "vue";
import { LayoutGrid, StretchHorizontal } from "lucide-vue-next";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-vue-next";

const props = defineProps<{
  nodes: Array<{ uuid: string; name: string; tags: string[] }>;
  selected: Array<{ uuid: string }>;
}>();

const emit = defineEmits<{
  (e: "update:selected", value: Array<{ uuid: string }>): void;
}>();

const selectedNodes = ref<Array<{ uuid: string }>>([...props.selected]);

const searchText = ref("");

const isSelect = (uuid: string) => {
  return selectedNodes.value.some((item) => item.uuid === uuid);
};

const pickNode = (uuid: string) => {
  const index = selectedNodes.value.findIndex((item) => item.uuid === uuid);
  if (index >= 0) {
    selectedNodes.value.splice(index, 1);
  } else {
    selectedNodes.value.push({ uuid });
  }
  emit("update:selected", [...selectedNodes.value]);
};

const pickAll = () => {
  const filteredUUIDs = filteredNodes.value.map((item) => item.uuid);
  const newSelectedMap = new Map<string, boolean>();

  selectedNodes.value.forEach((item) => newSelectedMap.set(item.uuid, true));

  filteredUUIDs.forEach((uuid) => newSelectedMap.set(uuid, true));

  selectedNodes.value = Array.from(newSelectedMap.keys()).map((uuid) => ({
    uuid,
  }));
  emit("update:selected", [...selectedNodes.value]);
};

const pickInvert = () => {
  const filteredUUIDs = filteredNodes.value.map((item) => item.uuid);
  const newSelectedMap = new Map<string, boolean>();

  props.nodes.forEach((node) => {
    if (filteredUUIDs.includes(node.uuid)) {
      newSelectedMap.set(node.uuid, !isSelect(node.uuid));
    } else {
      newSelectedMap.set(node.uuid, isSelect(node.uuid));
    }
  });

  selectedNodes.value = Array.from(newSelectedMap.entries())
    .filter(([_, selected]) => selected)
    .map(([uuid]) => ({ uuid }));

  emit("update:selected", [...selectedNodes.value]);
};

const showFunction = ref(true);

const tags = computed(() => {
  const tags = new Set<string>();
  props.nodes.forEach((node) => node.tags.forEach((tag) => tags.add(tag)));
  return Array.from(tags);
});
const tag = ref("all");

const filteredNodes = computed(() => {
  const text = searchText.value.trim().toLowerCase();
  return props.nodes.filter((node) => {
    const matchesText =
      node.name.toLowerCase().includes(text) || node.uuid.toLowerCase().includes(text);
    const matchesTag = tag.value === "all" || node.tags.includes(tag.value);
    return matchesText && matchesTag;
  });
});
</script>

<template>
  <div>
    <div
      v-if="props.nodes.length === 0"
      class="bg-background/60 absolute inset-0 z-50 flex h-full w-full items-center justify-center space-x-2 p-4"
    >
      <Loader2 class="h-6 w-6 animate-spin text-gray-500" />
      <span class="text-gray-500">Loading...</span>
    </div>
    <div class="mb-2 flex flex-col items-center justify-between gap-1 md:flex-row">
      <div class="flex w-full flex-col gap-1 md:w-auto md:flex-row">
        <div class="flex-1 md:w-32">
          <Select v-model="tag">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ $t("dashboard.batchExec.selectTag") }}</SelectItem>
              <SelectItem v-for="item in tags" :value="item">{{ item }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1 md:w-60">
          <Input v-model="searchText" :placeholder="$t('dashboard.batchExec.searchNodesTips')" />
        </div>
      </div>
      <div class="flex w-full items-center justify-end gap-1 md:w-auto">
        <div class="flex-1">
          <Button @click="pickAll()" class="w-full">{{
            $t("dashboard.batchExec.selectAll")
          }}</Button>
        </div>
        <div class="flex-1">
          <Button @click="pickInvert()" class="w-full" variant="outline">{{
            $t("dashboard.batchExec.inverseSelection")
          }}</Button>
        </div>
        <div
          class="hidden h-6 w-6 cursor-pointer md:block"
          @click="showFunction = !showFunction"
          :title="$t('dashboard.batchExec.toggleArrangementMode')"
        >
          <LayoutGrid class="h-6 w-6 text-gray-500" v-if="showFunction" />
          <StretchHorizontal class="h-6 w-6 text-gray-500" v-else />
        </div>
      </div>
    </div>

    <div
      class="max-h-50 overflow-auto"
      :class="
        showFunction
          ? 'grid grid-cols-1 gap-1 md:grid-cols-3 xl:grid-cols-4'
          : 'flex flex-col space-y-1'
      "
    >
      <Button
        v-for="node in filteredNodes"
        :key="node.uuid"
        :variant="isSelect(node.uuid) ? 'default' : 'outline'"
        class="h-16 text-left whitespace-normal"
        @click="pickNode(node.uuid)"
      >
        <div class="flex w-full flex-col items-start">
          <p class="w-full truncate font-medium">{{ node.name }}</p>
          <p class="w-full truncate text-xs break-words opacity-80">
            {{ node.uuid }}
          </p>
        </div>
      </Button>
    </div>
  </div>
</template>
