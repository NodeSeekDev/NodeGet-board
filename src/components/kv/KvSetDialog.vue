<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeStore } from "@/stores/theme";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  editKey?: string;
  editValue?: unknown;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [key: string, value: unknown];
}>();

const themeStore = useThemeStore();

const key = ref("");
const editorValue = ref("");

const extensions = computed(() => [
  json(),
  ...(themeStore.isDark ? [oneDark] : []),
]);

watch(
  () => props.open,
  (open) => {
    if (open) {
      key.value = props.editKey ?? "";
      editorValue.value =
        props.editValue !== undefined
          ? JSON.stringify(props.editValue, null, 2)
          : "{}";
    }
  },
);

const isEditMode = () => props.editKey !== undefined;

const handleSave = () => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(editorValue.value);
  } catch {
    return;
  }
  emit("save", key.value.trim(), parsed);
};

const close = () => emit("update:open", false);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{
          isEditMode() ? "编辑 Key-Value" : "新增 Key-Value"
        }}</DialogTitle>
        <DialogDescription>Value 必须为合法的 JSON 格式</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div v-if="!isEditMode()" class="space-y-2">
          <Label for="kv-key">Key</Label>
          <Input id="kv-key" v-model="key" placeholder="输入 key" />
        </div>

        <div class="space-y-2">
          <Label>Value</Label>
          <div class="rounded-md border overflow-hidden">
            <Codemirror
              v-model="editorValue"
              :extensions="extensions"
              :style="{ height: '240px', fontSize: '13px' }"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">取消</Button>
        <Button :disabled="loading" @click="handleSave">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
