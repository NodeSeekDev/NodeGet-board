<script setup lang="ts">
import { computed } from "vue";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useThemeStore } from "@/stores/theme";

const props = defineProps<{
  open: boolean;
  kvKey: string;
  loading?: boolean;
  value: unknown;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const themeStore = useThemeStore();

const extensions = computed(() => [
  json(),
  ...(themeStore.isDark ? [oneDark] : []),
]);

const displayValue = computed(() =>
  props.value !== undefined ? JSON.stringify(props.value, null, 2) : "",
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>查看 Key-Value</DialogTitle>
        <DialogDescription class="font-mono">{{ kvKey }}</DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="text-center py-8 text-muted-foreground">
        加载中...
      </div>
      <div v-else class="rounded-md border overflow-hidden">
        <Codemirror
          :model-value="displayValue"
          :extensions="extensions"
          :disabled="true"
          :style="{ height: '280px', fontSize: '13px' }"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
