<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  Folder,
  FileArchive,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { base64ToBuf } from "@/utils/base64";
import {
  parseZipFile,
  parseFolderFiles,
  type FileEntry,
} from "@/composables/useFileUploadParsing";
import { useStaticBucket } from "@/composables/useStaticBucket";
import {
  useThemeBucketUpload,
  type KeepPolicy,
  DEFAULT_KEEP_POLICY,
} from "@/composables/useThemeBucketUpload";

const props = defineProps<{
  open: boolean;
  targetBucket?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const sb = useStaticBucket();
const { uploadToBucket } = useThemeBucketUpload();

const bucketName = ref("");
const fileList = ref<FileEntry[]>([]);
const folderInputRef = ref<HTMLInputElement | null>(null);
const zipInputRef = ref<HTMLInputElement | null>(null);
const processing = ref(false);
const processError = ref<string | null>(null);
const uploading = ref(false);
const uploadProgress = ref({ current: 0, total: 0 });

const detectedShort = ref<string | null>(null);
const detectedName = ref<string | null>(null);
const missingShort = ref(false);

const keepPolicy = ref<KeepPolicy>({ ...DEFAULT_KEEP_POLICY });

const clearFileList = () => {
  fileList.value = [];
  detectedShort.value = null;
  detectedName.value = null;
  missingShort.value = false;
};

const canSubmit = computed(
  () =>
    fileList.value.length > 0 &&
    (!!props.targetBucket || (!!bucketName.value && !!detectedShort.value)),
);

watch(
  () => props.open,
  (val) => {
    if (val) {
      bucketName.value = props.targetBucket ?? "";
      fileList.value = [];
      processError.value = null;
      detectedShort.value = null;
      detectedName.value = null;
      missingShort.value = false;
      uploadProgress.value = { current: 0, total: 0 };
      keepPolicy.value = { ...DEFAULT_KEEP_POLICY };
    }
  },
);

const parseThemeJson = (files: FileEntry[]) => {
  const themeFile = files.find(
    (f) =>
      f.path === "nodeget-theme.json" || f.path.endsWith("/nodeget-theme.json"),
  );
  missingShort.value = false;
  detectedShort.value = null;
  detectedName.value = null;

  if (!themeFile) {
    if (!props.targetBucket) missingShort.value = true;
    return;
  }

  try {
    const text = new TextDecoder().decode(base64ToBuf(themeFile.base64));
    const json = JSON.parse(text);
    if (typeof json?.short === "string" && json.short) {
      detectedShort.value = json.short;
      detectedName.value =
        typeof json.name === "string" && json.name ? json.name : json.short;
      if (!props.targetBucket) {
        bucketName.value = `theme_${json.short}`;
      }
    } else {
      if (!props.targetBucket) missingShort.value = true;
    }
  } catch {
    if (!props.targetBucket) missingShort.value = true;
  }
};

const processFiles = async (parseFn: () => Promise<FileEntry[]>) => {
  processing.value = true;
  processError.value = null;
  try {
    const result = await parseFn();
    fileList.value = result;
    parseThemeJson(result);
  } catch (e: unknown) {
    processError.value = e instanceof Error ? e.message : String(e);
  } finally {
    processing.value = false;
  }
};

const onFolderChange = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  (e.target as HTMLInputElement).value = "";
  if (!files.length) return;
  await processFiles(() => parseFolderFiles(files));
};

const onZipChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file) return;
  await processFiles(() => file.arrayBuffer().then(parseZipFile));
};

const handleUpload = async () => {
  if (!canSubmit.value) return;
  uploading.value = true;
  uploadProgress.value = { current: 0, total: fileList.value.length };
  try {
    const targetName = props.targetBucket ?? bucketName.value;

    if (!props.targetBucket) {
      await sb.createBucket({
        name: targetName,
        path: targetName,
        is_http_root: false,
        cors: true,
        enable: true,
      });
    }

    const { failedCount } = await uploadToBucket({
      bucketName: targetName,
      files: fileList.value,
      isUpdate: !!props.targetBucket,
      keepPolicy: keepPolicy.value,
      onProgress: (current, total) => {
        uploadProgress.value = { current, total };
      },
    });

    const displayName = detectedName.value ?? targetName;
    if (failedCount > 0) {
      toast.warning(
        `主题「${displayName}」上传完成，${failedCount} 个文件上传失败`,
      );
    } else {
      toast.success(
        `主题「${displayName}」上传完成，共 ${fileList.value.length} 个文件`,
      );
    }
    emit("done");
    emit("update:open", false);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    uploading.value = false;
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{
            targetBucket ? `重新上传到「${targetBucket}」` : "从本地上传主题"
          }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div
          v-if="detectedShort && !targetBucket"
          class="space-y-0.5 rounded-md bg-muted px-3 py-2 text-sm"
        >
          <div>
            检测到主题：<span class="font-medium">{{ detectedName }}</span>
          </div>
          <div class="text-xs text-muted-foreground">
            Bucket 名称：<span class="font-mono">{{ bucketName }}</span>
          </div>
        </div>

        <div
          v-if="missingShort && !targetBucket"
          class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
          <span
            >未找到 nodeget-theme.json 或缺少 short 字段，无法确定主题标识</span
          >
        </div>

        <div class="space-y-2">
          <Label>选择内容</Label>
          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              class="h-20 flex-col gap-2"
              :disabled="processing || uploading"
              @click="folderInputRef?.click()"
            >
              <Folder class="h-6 w-6 text-muted-foreground" />
              <span class="text-xs">选择文件夹</span>
            </Button>
            <Button
              variant="outline"
              class="h-20 flex-col gap-2"
              :disabled="processing || uploading"
              @click="zipInputRef?.click()"
            >
              <FileArchive class="h-6 w-6 text-muted-foreground" />
              <span class="text-xs">选择 ZIP</span>
            </Button>
          </div>
          <input
            ref="folderInputRef"
            type="file"
            class="hidden"
            webkitdirectory
            @change="onFolderChange"
          />
          <input
            ref="zipInputRef"
            type="file"
            class="hidden"
            accept=".zip"
            @change="onZipChange"
          />
        </div>

        <div
          v-if="processing"
          class="flex items-center gap-2 py-2 text-sm text-muted-foreground"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          正在处理文件...
        </div>

        <div v-else-if="fileList.length" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label>已选 {{ fileList.length }} 个文件</Label>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              :disabled="uploading"
              @click="clearFileList"
            >
              <X class="mr-1 h-3 w-3" />
              清除
            </Button>
          </div>
          <div class="max-h-32 overflow-y-auto rounded-md border">
            <div
              v-for="f in fileList.slice(0, 50)"
              :key="f.path"
              class="border-b px-3 py-1 font-mono text-xs text-muted-foreground last:border-0"
            >
              {{ f.path }}
            </div>
            <div
              v-if="fileList.length > 50"
              class="px-3 py-1 text-xs text-muted-foreground italic"
            >
              ...还有 {{ fileList.length - 50 }} 个文件
            </div>
          </div>
        </div>

        <div
          v-if="targetBucket"
          class="overflow-hidden rounded-md border text-sm"
        >
          <div class="bg-muted px-3 py-1.5 text-xs font-medium">更新选项</div>
          <div class="divide-y">
            <div class="flex items-center justify-between px-3 py-2">
              <span>主题配置（user_preferences）</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-userPrefs"
                    value="old"
                    v-model="keepPolicy.userPrefs"
                    :disabled="uploading"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-userPrefs"
                    value="new"
                    v-model="keepPolicy.userPrefs"
                    :disabled="uploading"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>Token（site_tokens）</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-siteTokens"
                    value="old"
                    v-model="keepPolicy.siteTokens"
                    :disabled="uploading"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-siteTokens"
                    value="new"
                    v-model="keepPolicy.siteTokens"
                    :disabled="uploading"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>自定义 CSS</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-css"
                    value="old"
                    v-model="keepPolicy.css"
                    :disabled="uploading"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-css"
                    value="new"
                    v-model="keepPolicy.css"
                    :disabled="uploading"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>自定义 JS</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-js"
                    value="old"
                    v-model="keepPolicy.js"
                    :disabled="uploading"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="keep-js"
                    value="new"
                    v-model="keepPolicy.js"
                    :disabled="uploading"
                  />
                  采用新配置
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="uploading"
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          正在上传第 {{ uploadProgress.current }} /
          {{ uploadProgress.total }} 个文件
        </div>

        <p v-if="processError" class="text-sm text-destructive">
          {{ processError }}
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="uploading"
          @click="$emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          :disabled="uploading || processing || !canSubmit"
          @click="handleUpload"
        >
          <Loader2 v-if="uploading" class="mr-1 h-4 w-4 animate-spin" />
          {{ targetBucket ? "上传" : "创建并上传" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
