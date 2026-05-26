<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { StaticBucketInput } from "@/composables/useStaticBucket";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
  /** 有值则为编辑模式 */
  initial?: StaticBucketInput | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [input: StaticBucketInput];
}>();

const isEdit = computed(() => !!props.initial);
const form = ref<StaticBucketInput>({
  name: "",
  path: "",
  is_http_root: false,
  cors: false,
  enable: true,
});

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = props.initial
        ? { ...props.initial }
        : {
            name: "",
            path: "",
            is_http_root: false,
            cors: false,
            enable: true,
          };
    }
  },
);

const handleSave = () => {
  emit("save", { ...form.value });
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? "编辑 Bucket" : "创建 Bucket" }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-1.5">
          <Label for="sb-name"
            >名称 <span class="text-destructive">*</span></Label
          >
          <Input
            id="sb-name"
            v-model="form.name"
            placeholder="my-site"
            :disabled="isEdit"
            class="font-mono"
          />
          <p v-if="isEdit" class="text-xs text-muted-foreground">
            名称不可修改
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="sb-path"
            >路径 <span class="text-destructive">*</span></Label
          >
          <Input
            id="sb-path"
            v-model="form.path"
            placeholder="my-site"
            class="font-mono"
          />
          <p class="text-xs text-muted-foreground">
            相对磁盘路径，支持 / 嵌套目录
          </p>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <Label>HTTP 根路由</Label>
            <p class="text-xs text-muted-foreground">
              将此 Bucket 挂载为 / 根路由
            </p>
          </div>
          <Switch v-model:modelValue="form.is_http_root" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <Label>CORS</Label>
            <p class="text-xs text-muted-foreground">
              启用 Access-Control-Allow-Origin: *
            </p>
          </div>
          <Switch v-model:modelValue="form.cors" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <Label>HTTP 访问</Label>
            <p class="text-xs text-muted-foreground">
              启用此 Bucket 的 Http 访问
            </p>
          </div>
          <Switch v-model:modelValue="form.enable" />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)"
          >取消</Button
        >
        <Button
          :disabled="loading || !form.name || !form.path"
          @click="handleSave"
        >
          <Loader2 v-if="loading" class="mr-1 h-4 w-4 animate-spin" />
          {{ isEdit ? "保存" : "创建" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
