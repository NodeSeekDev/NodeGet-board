<script setup lang="ts">
import { ref, watch } from "vue";
import { type TokenLimitEntry } from "../type";
import { ChevronsUpDown, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PopConfirm } from "@/components/ui/pop-confirm";
import limitScopeConfig from "./limitScopeConfig.vue";

const props = defineProps<{
  tokenLimit: TokenLimitEntry;
  index: number;
  limitLength: number;
}>();
const emits = defineEmits<{
  (e: "update:tokenLimit", tokenLimit: TokenLimitEntry): void;
  (e: "deleteLimit", index: number): void;
}>();

const localTokenLimit = ref<TokenLimitEntry>(props.tokenLimit);
const isOpen = ref(false);

watch(
  () => props.tokenLimit,
  (value) => {
    localTokenLimit.value = value;
  },
);

watch(
  localTokenLimit,
  (value) => {
    emits("update:tokenLimit", value);
  },
  { deep: true },
);

const handleDeleteLimit = () => {
  emits("deleteLimit", props.index);
};
</script>

<template>
  <Collapsible v-model:open="isOpen" class="space-y-2">
    <div class="flex w-full items-center justify-between gap-2">
      <div>权限{{ props.index + 1 }}</div>
      <div class="flex-1"></div>
      <PopConfirm
        v-if="props.limitLength > 1"
        title="确认删除权限"
        description="删除后当前权限配置将无法恢复。"
        confirm-text="删除"
        cancel-text="取消"
        @confirm="handleDeleteLimit"
      >
        <Button variant="ghost" size="icon" class="size-8 text-red-500">
          <Trash2 />
          <span class="sr-only">Delete</span>
        </Button>
      </PopConfirm>
      <CollapsibleTrigger as-child>
        <div class="flex content-end">
          <Button variant="ghost" size="icon" class="size-8">
            <ChevronsUpDown />
            <span class="sr-only">Toggle</span>
          </Button>
        </div>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent class="space-y-2">
      <limitScopeConfig v-model:scope="localTokenLimit.scopes" />
    </CollapsibleContent>
  </Collapsible>
</template>
