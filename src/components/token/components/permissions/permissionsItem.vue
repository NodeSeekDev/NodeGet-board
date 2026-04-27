<script setup lang="ts">
import { onMounted, ref, useId, watch } from "vue";
import { type PermissionEntry, type PermissionItemConfig } from "../../type";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const props = defineProps<{
  permissionsItem: PermissionEntry;
  configItem: PermissionItemConfig;
}>();
const emits = defineEmits<{
  (
    e: "update:permissionsItem",
    permissionsItem: PermissionEntry,
    permissionsName: string,
  ): void;
}>();

const localPermissions = ref<PermissionEntry>(props.permissionsItem);
const isOpen = ref(false);
const currentActiveButton = ref("");

watch(
  () => props.permissionsItem,
  (value) => {
    localPermissions.value = value;
  },
  { immediate: true },
);

watch(
  localPermissions,
  (value) => {
    emits("update:permissionsItem", value, props.configItem.name);
  },
  { deep: true },
);

onMounted(() => {
  console.log(
    "当前的permissionsItem",
    localPermissions.value,
    props.permissionsItem,
    props.configItem,
  );
});

// 处理点击权限
const handleToggle = (item: string) => {
  currentActiveButton.value = item;
};

const getChildKeys = (item: string) => {
  const value = (props.configItem.value as Record<string, unknown>)[item];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>);
};
</script>

<template>
  <Collapsible v-model:open="isOpen" class="w-full">
    <div class="flex w-full items-center justify-between gap-2">
      <div>{{ props.configItem.name }}</div>
      <div class="flex-1"></div>
      <CollapsibleTrigger as-child>
        <div class="flex content-end">
          <Button variant="ghost" size="icon" class="size-8">
            <ChevronsUpDown />
            <span class="sr-only">Toggle</span>
          </Button>
        </div>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent class="flex flex-col gap-2">
      <!-- <Label v-for="item in props.configItem.value" :key="item">
        <Checkbox> </Checkbox>
        {{ item }}
      </Label> -->
      <div class="flex items-center gap-2">
        <Button
          v-for="(item, index) in Object.keys(props.configItem.value)"
          :key="`${item}-${index}`"
          :variant="currentActiveButton == item ? 'default' : 'outline'"
          @click="handleToggle(item)"
          >{{ item }}</Button
        >
      </div>
      <div
        v-for="item in Object.keys(props.configItem.value)"
        :key="item"
        v-show="item === currentActiveButton"
        class="flex gap-2 flex-wrap"
      >
        <Button variant="outline" v-for="(info, index) in getChildKeys(item)">
          {{ info }}
        </Button>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
