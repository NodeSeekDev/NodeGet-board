<script setup lang="ts">
import { ref } from "vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const open = ref(false);

const handleConfirm = () => {
  open.value = false;
  emit("confirm");
};

const handleCancel = () => {
  open.value = false;
  emit("cancel");
};
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent class="w-52 p-3" side="top" :align="'center'">
      <div class="space-y-2">
        <div class="space-y-0.5">
          <p v-if="title" class="text-sm font-medium">{{ title }}</p>
          <p v-if="description" class="text-sm text-muted-foreground">
            {{ description }}
          </p>
        </div>
        <div class="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            class="h-6 px-2 text-xs"
            :disabled="loading"
            @click="handleCancel"
          >
            {{ cancelText ?? "取消" }}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            class="h-6 px-2 text-xs"
            :disabled="loading"
            @click="handleConfirm"
          >
            {{ loading ? "处理中..." : (confirmText ?? "确认") }}
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
