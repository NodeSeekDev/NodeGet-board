<script setup lang="ts">
import { ref, watch } from "vue";
import { CheckCircle, AlertCircle, Loader2, Zap } from "lucide-vue-next";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExtensions } from "@/composables/useExtensions";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

type Step = "form" | "creating" | "done";

const step = ref<Step>("form");
const extName = ref("");
const workerName = ref("");
const workerList = ref<string[]>([]);
const progressMessages = ref<string[]>([]);
const createdId = ref<string | null>(null);
const formError = ref<string | null>(null);

const { createQuickExtension } = useExtensions();
const jsRuntime = useJsRuntime();

// 打开时拉取 worker 列表
watch(
  () => props.open,
  async (opened) => {
    if (!opened) return;
    // 重置表单状态
    step.value = "form";
    extName.value = "";
    workerName.value = "";
    progressMessages.value = [];
    createdId.value = null;
    formError.value = null;

    try {
      workerList.value = await jsRuntime.listAllWorkers();
    } catch {
      workerList.value = [];
    }
  },
);

const handleClose = () => {
  if (step.value === "creating") return;
  emit("update:open", false);
};

const handleConfirm = async () => {
  formError.value = null;
  if (!extName.value.trim()) {
    formError.value = "请填写扩展名称";
    return;
  }
  if (!workerName.value) {
    formError.value = "请选择 Worker";
    return;
  }

  step.value = "creating";
  progressMessages.value = [];

  try {
    const id = await createQuickExtension(
      extName.value.trim(),
      workerName.value,
      (msg) => {
        progressMessages.value.push(msg);
      },
    );
    createdId.value = id;
    step.value = "done";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "创建失败";
    toast.error(msg);
    step.value = "form";
    formError.value = msg;
  }
};

const handleDone = () => {
  emit("created");
  emit("update:open", false);
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleClose">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Zap class="h-4 w-4" />
          快捷 Extension
        </DialogTitle>
        <DialogDescription>
          将已有的 JS Worker 注册为扩展应用，无需上传完整扩展包。
        </DialogDescription>
      </DialogHeader>

      <!-- 步骤：填写表单 -->
      <template v-if="step === 'form'">
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label for="quick-ext-name">扩展名称</Label>
            <Input
              id="quick-ext-name"
              v-model="extName"
              placeholder="例如：我的工具"
              @keydown.enter="handleConfirm"
            />
          </div>

          <div class="space-y-2">
            <Label for="quick-ext-worker">Worker 名称</Label>
            <Select v-model="workerName">
              <SelectTrigger id="quick-ext-worker">
                <SelectValue placeholder="选择已有 Worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="w in workerList" :key="w" :value="w">
                  {{ w }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              v-if="workerList.length === 0"
              class="text-xs text-muted-foreground"
            >
              暂无可用 Worker
            </p>
          </div>

          <p
            v-if="formError"
            class="text-sm text-destructive flex items-center gap-1"
          >
            <AlertCircle class="h-4 w-4 flex-shrink-0" />
            {{ formError }}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="handleClose">取消</Button>
          <Button @click="handleConfirm">
            <Zap class="h-4 w-4 mr-2" />
            创建
          </Button>
        </DialogFooter>
      </template>

      <!-- 步骤：创建中 -->
      <template v-else-if="step === 'creating'">
        <div class="py-4 space-y-4">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin" />
            正在创建快捷扩展，请稍候...
          </div>
          <div class="h-32 overflow-y-auto rounded-md border bg-muted/30 p-2">
            <div class="space-y-1 font-mono text-xs text-muted-foreground">
              <p v-for="(msg, i) in progressMessages" :key="i">{{ msg }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- 步骤：完成 -->
      <template v-else-if="step === 'done'">
        <div class="py-6 flex flex-col items-center gap-3">
          <CheckCircle class="h-10 w-10 text-green-500" />
          <p class="text-sm font-medium">快捷扩展创建成功！</p>
          <p class="text-xs text-muted-foreground font-mono">
            ID: {{ createdId }}
          </p>
        </div>

        <DialogFooter>
          <Button @click="handleDone">完成</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
