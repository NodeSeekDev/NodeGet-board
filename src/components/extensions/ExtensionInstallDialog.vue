<script setup lang="ts">
import { ref, computed } from "vue";
import { diffLines } from "diff";
import {
  FolderOpen,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AppJson, Extension } from "@/composables/useExtensions";
import { extractZipToFiles } from "@/composables/useExtensions";

const props = defineProps<{
  open: boolean;
  reinstallTarget?: Extension | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  install: [files: File[]];
  reinstall: [target: Extension, files: File[]];
}>();

const isReinstall = computed(() => !!props.reinstallTarget);

// 安装步骤：select（选择文件）| confirm（确认信息）| installing（安装中）| done（完成）
type Step = "select" | "confirm" | "installing" | "done";

const step = ref<Step>("select");
const selectedFiles = ref<File[]>([]);
const parsedApp = ref<AppJson | null>(null);
const parseError = ref<string | null>(null);
const progressMessages = ref<string[]>([]);
const installError = ref<string | null>(null);
const installedId = ref<string | null>(null);
const tokenAgreed = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const zipInputRef = ref<HTMLInputElement | null>(null);

const routeTypeLabel = (type: string) =>
  type === "global" ? "全局路由" : "节点路由";
const routeTypeBadgeVariant = (type: string) =>
  type === "global" ? ("default" as const) : ("secondary" as const);

const limitsCount = computed(() => parsedApp.value?.limits?.length ?? 0);

const normalizeJson = (val: unknown): unknown => {
  if (Array.isArray(val)) return val.map(normalizeJson);
  if (val !== null && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalizeJson(v)]),
    );
  }
  return val;
};

const limitsChanged = computed(() => {
  if (!isReinstall.value || !props.reinstallTarget) return true;
  const oldLimits = JSON.stringify(
    normalizeJson(props.reinstallTarget.app.limits ?? []),
  );
  const newLimits = JSON.stringify(
    normalizeJson(parsedApp.value?.limits ?? []),
  );
  return oldLimits !== newLimits;
});

const needsTokenConfirm = computed(
  () => !isReinstall.value || limitsChanged.value,
);

type DiffLine = { text: string; added: boolean; removed: boolean };

const limitsDiff = computed((): DiffLine[] | null => {
  if (!isReinstall.value || !props.reinstallTarget) return null;
  const oldStr = JSON.stringify(
    normalizeJson(props.reinstallTarget.app.limits ?? []),
    null,
    2,
  );
  const newStr = JSON.stringify(
    normalizeJson(parsedApp.value?.limits ?? []),
    null,
    2,
  );
  return diffLines(oldStr, newStr).flatMap((part) => {
    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    const lines = part.value.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines.map((line) => ({
      text: prefix + line,
      added: !!part.added,
      removed: !!part.removed,
    }));
  });
});

const reset = () => {
  step.value = "select";
  selectedFiles.value = [];
  parsedApp.value = null;
  parseError.value = null;
  progressMessages.value = [];
  installError.value = null;
  installedId.value = null;
  tokenAgreed.value = false;
};

const handleClose = () => {
  if (step.value === "installing") return;
  reset();
  emit("update:open", false);
};

const openFolderPicker = () => fileInputRef.value?.click();
const openZipPicker = () => zipInputRef.value?.click();

const onZipSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const zipFile = input.files?.[0];
  if (!zipFile) return;
  parseError.value = null;
  parsedApp.value = null;
  input.value = "";
  try {
    const files = await extractZipToFiles(zipFile);
    await processFiles(files);
  } catch (e: unknown) {
    parseError.value = `ZIP 解析失败：${e instanceof Error ? e.message : String(e)}`;
  }
};

const onFilesSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const files = Array.from(input.files);
  input.value = "";
  await processFiles(files);
};

const processFiles = async (files: File[]) => {
  selectedFiles.value = files;
  parseError.value = null;
  parsedApp.value = null;

  const appJsonFile = files.find((f) => {
    const parts = f.webkitRelativePath.split("/");
    return parts[parts.length - 1] === "app.json" && parts.length === 2;
  });

  if (!appJsonFile) {
    parseError.value = "未找到根目录下的 app.json 文件";
    return;
  }

  try {
    const text = await appJsonFile.text();
    parsedApp.value = JSON.parse(text);
    tokenAgreed.value = false;
    step.value = "confirm";
  } catch {
    parseError.value = "app.json 格式错误，无法解析 JSON";
  }
};

const handleInstall = () => {
  step.value = "installing";
  progressMessages.value = [];
  installError.value = null;
  if (isReinstall.value && props.reinstallTarget) {
    emit("reinstall", props.reinstallTarget, selectedFiles.value);
  } else {
    emit("install", selectedFiles.value);
  }
};

// 供父组件调用，更新进度
const onProgress = (msg: string) => {
  progressMessages.value.push(msg);
};

const onInstallDone = (id: string) => {
  installedId.value = id;
  step.value = "done";
};

const onInstallError = (err: string) => {
  installError.value = err;
  step.value = "confirm";
};

defineExpose({ onProgress, onInstallDone, onInstallError });
</script>

<template>
  <Dialog :open="props.open" @update:open="handleClose">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          isReinstall
            ? `重装「${props.reinstallTarget?.app.name}」`
            : "安装扩展"
        }}</DialogTitle>
        <DialogDescription>
          {{
            isReinstall
              ? "重新选择扩展文件夹，保持原 UUID 不变；若权限变化则重新签发 Token。"
              : "选择扩展文件夹，解析 app.json，确认权限后完成安装。"
          }}
        </DialogDescription>
      </DialogHeader>

      <!-- 步骤：选择文件 -->
      <template v-if="step === 'select'">
        <div class="flex flex-col items-center gap-4 py-6">
          <div class="grid grid-cols-2 gap-3 w-full">
            <div
              class="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-muted-foreground/60 transition-colors"
              @click="openFolderPicker"
            >
              <FolderOpen class="h-8 w-8 text-muted-foreground" />
              <p class="text-xs text-muted-foreground text-center">
                打开文件夹
              </p>
            </div>
            <div
              class="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-muted-foreground/60 transition-colors"
              @click="openZipPicker"
            >
              <Upload class="h-8 w-8 text-muted-foreground" />
              <p class="text-xs text-muted-foreground text-center">打开 ZIP</p>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            需包含 app.json 和 resources/ 目录
          </p>

          <p
            v-if="parseError"
            class="text-sm text-destructive flex items-center gap-1"
          >
            <AlertCircle class="h-4 w-4 flex-shrink-0" />{{ parseError }}
          </p>

          <input
            ref="fileInputRef"
            type="file"
            webkitdirectory
            class="hidden"
            @change="onFilesSelected"
          />
          <input
            ref="zipInputRef"
            type="file"
            accept=".zip"
            class="hidden"
            @change="onZipSelected"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" @click="handleClose">取消</Button>
        </DialogFooter>
      </template>

      <!-- 步骤：确认信息 -->
      <template v-else-if="step === 'confirm'">
        <div class="max-h-80 overflow-y-auto">
          <div class="space-y-4 pr-2">
            <!-- 基本信息 -->
            <div class="space-y-2">
              <h4 class="text-sm font-medium">扩展信息</h4>
              <div class="rounded-md border p-3 space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">名称</span>
                  <span class="font-medium">{{ parsedApp?.name || "—" }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">版本</span>
                  <span>{{ parsedApp?.version || "—" }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">描述</span>
                  <span class="text-right max-w-48 truncate">{{
                    parsedApp?.description || "—"
                  }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">文件数</span>
                  <span>{{ selectedFiles.length }}</span>
                </div>
              </div>
            </div>

            <!-- 路由信息 -->
            <div v-if="parsedApp?.routes?.length" class="space-y-2">
              <h4 class="text-sm font-medium">
                注册路由 ({{ parsedApp.routes.length }})
              </h4>
              <div class="space-y-1">
                <div
                  v-for="route in parsedApp.routes"
                  :key="route.name"
                  class="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span class="font-mono text-xs">{{ route.name }}</span>
                  <Badge
                    :variant="routeTypeBadgeVariant(route.type)"
                    class="text-xs"
                  >
                    {{ routeTypeLabel(route.type) }}
                  </Badge>
                </div>
              </div>
            </div>

            <!-- Token 权限询问（仅新安装或权限有变化时显示） -->
            <div v-if="needsTokenConfirm" class="space-y-2">
              <h4 class="text-sm font-medium">
                {{ limitsDiff ? "权限变更" : "是否创建以下权限的 Token？" }}
              </h4>

              <!-- 重装且权限有变化：显示 diff -->
              <div v-if="limitsDiff" class="rounded-md border overflow-hidden">
                <pre
                  class="p-3 text-xs font-mono overflow-x-auto max-h-48 leading-5"
                ><span
                  v-for="(line, i) in limitsDiff"
                  :key="i"
                  :class="[
                    'block',
                    line.added ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                    line.removed ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
                    'text-muted-foreground',
                  ]"
                >{{ line.text }}</span></pre>
              </div>

              <!-- 新安装：显示完整 JSON -->
              <template v-else>
                <div
                  v-if="limitsCount > 0"
                  class="rounded-md border overflow-hidden"
                >
                  <pre
                    class="p-3 text-xs font-mono bg-muted/30 overflow-x-auto whitespace-pre-wrap break-all max-h-32"
                    >{{
                      JSON.stringify(
                        normalizeJson(parsedApp?.limits ?? []),
                        null,
                        2,
                      )
                    }}</pre
                  >
                </div>
                <div
                  v-else
                  class="rounded-md border p-3 text-xs text-muted-foreground font-mono bg-muted/30"
                >
                  默认只读监控权限（cpu、system）
                </div>
              </template>
              <label
                class="flex items-center gap-2 cursor-pointer select-none text-sm"
              >
                <input
                  v-model="tokenAgreed"
                  type="checkbox"
                  class="h-4 w-4 rounded"
                />
                我同意为此扩展创建上述权限的 Token
              </label>
            </div>

            <!-- 安装错误提示 -->
            <p
              v-if="installError"
              class="text-sm text-destructive flex items-center gap-1"
            >
              <AlertCircle class="h-4 w-4 flex-shrink-0" />
              {{ installError }}
            </p>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="step = 'select'">返回</Button>
          <Button
            :disabled="needsTokenConfirm && !tokenAgreed"
            @click="handleInstall"
          >
            <Upload class="h-4 w-4 mr-2" />
            {{ isReinstall ? "确认重装" : "创建 Token 并安装" }}
          </Button>
        </DialogFooter>
      </template>

      <!-- 步骤：安装中 -->
      <template v-else-if="step === 'installing'">
        <div class="py-4 space-y-4">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin" />
            正在安装扩展，请稍候...
          </div>
          <div class="h-40 overflow-y-auto rounded-md border bg-muted/30 p-2">
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
          <p class="text-sm font-medium">扩展安装成功！</p>
          <p class="text-xs text-muted-foreground font-mono">
            ID: {{ installedId }}
          </p>
        </div>

        <DialogFooter>
          <Button @click="handleClose">完成</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
