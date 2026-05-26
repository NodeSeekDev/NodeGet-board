<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Folder, FileArchive, Loader2, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  parseZipFile,
  parseFolderFiles,
} from "@/composables/useFileUploadParsing";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
  /** 有值则为向已有 bucket 上传（重传），无值则创建新 bucket */
  targetBucket?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  create: [bucketName: string, files: Array<{ path: string; base64: string }>];
  upload: [files: Array<{ path: string; base64: string }>];
}>();

const bucketName = ref("");
const fileList = ref<Array<{ path: string; base64: string }>>([]);
const folderInputRef = ref<HTMLInputElement | null>(null);
const zipInputRef = ref<HTMLInputElement | null>(null);
const processing = ref(false);
const processError = ref<string | null>(null);

const canSubmit = computed(
  () =>
    fileList.value.length > 0 && (!!props.targetBucket || !!bucketName.value),
);

watch(
  () => props.open,
  (val) => {
    if (val) {
      bucketName.value = props.targetBucket ?? "";
      fileList.value = [];
      processError.value = null;
    }
  },
);

const onFolderChange = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  (e.target as HTMLInputElement).value = "";
  if (!files.length) return;
  processing.value = true;
  processError.value = null;
  try {
    const folderName = files[0]?.webkitRelativePath.split("/")[0] ?? "";
    if (folderName && !bucketName.value) bucketName.value = folderName;
    fileList.value = await parseFolderFiles(files);
  } catch (e: unknown) {
    processError.value = e instanceof Error ? e.message : String(e);
  } finally {
    processing.value = false;
  }
};

const onZipChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file) return;
  const zipBaseName = file.name.replace(/\.zip$/i, "");
  if (zipBaseName && !bucketName.value) bucketName.value = zipBaseName;
  processing.value = true;
  processError.value = null;
  try {
    fileList.value = await parseZipFile(await file.arrayBuffer());
  } catch (e: unknown) {
    processError.value = e instanceof Error ? e.message : String(e);
  } finally {
    processing.value = false;
  }
};

const handleSubmit = () => {
  if (props.targetBucket) {
    emit("upload", fileList.value);
  } else {
    emit("create", bucketName.value, fileList.value);
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ targetBucket ? `重新上传到「${targetBucket}」` : "上传本地目录" }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div v-if="!targetBucket" class="space-y-1.5">
          <Label for="dir-bucket-name"
            >Bucket 名称 <span class="text-destructive">*</span></Label
          >
          <Input
            id="dir-bucket-name"
            v-model="bucketName"
            placeholder="my-site"
            class="font-mono"
          />
        </div>

        <div class="space-y-2">
          <Label>选择内容</Label>
          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              class="h-20 flex-col gap-2"
              @click="folderInputRef?.click()"
            >
              <Folder class="h-6 w-6 text-muted-foreground" />
              <span class="text-xs">选择文件夹</span>
            </Button>
            <Button
              variant="outline"
              class="h-20 flex-col gap-2"
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
          class="flex items-center gap-2 text-sm text-muted-foreground py-2"
        >
          <Loader2 class="h-4 w-4 animate-spin" />正在处理文件...
        </div>
        <div v-else-if="fileList.length" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label>已选 {{ fileList.length }} 个文件</Label>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="fileList = []"
            >
              <X class="h-3 w-3 mr-1" />清除
            </Button>
          </div>
          <div class="border rounded-md max-h-32 overflow-y-auto">
            <div
              v-for="f in fileList.slice(0, 50)"
              :key="f.path"
              class="px-3 py-1 text-xs font-mono border-b last:border-0 text-muted-foreground"
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

        <p v-if="processError || error" class="text-sm text-destructive">
          {{ processError || error }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)"
          >取消</Button
        >
        <Button
          :disabled="loading || processing || !canSubmit"
          @click="handleSubmit"
        >
          <Loader2 v-if="loading" class="h-4 w-4 mr-1 animate-spin" />
          {{ targetBucket ? "上传" : "创建并上传" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
