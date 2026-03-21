<script setup lang="ts">
import { onMounted, ref, useId, watch } from "vue";
import { type PermissionEntry, type PermissionItemConfig } from "../../type";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  );
});

// 处理点击权限
const handleToggle = (item: string) => {
  localPermissions.value[item] = !localPermissions.value[item];
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
    <CollapsibleContent class="flex items-center gap-2">
      <!-- <Label v-for="item in props.configItem.value" :key="item">
        <Checkbox> </Checkbox>
        {{ item }}
      </Label> -->
      <Button
        variant="outline"
        v-for="(item, index) in props.configItem.value"
        :key="`${item}-${index}`"
        @click="handleToggle(item)"
        >{{ item }}</Button
      >
    </CollapsibleContent>
  </Collapsible>
</template>
