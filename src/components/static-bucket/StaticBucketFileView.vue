<script setup lang="ts">
import { ref, computed, watch, provide, TransitionGroup } from "vue";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/legacy-modes/mode/javascript";
import { css } from "@codemirror/legacy-modes/mode/css";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import type { Extension as CMExtension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { useThemeStore } from "@/stores/theme";
import {
  Upload,
  Save,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Archive,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import type { BucketFile } from "@/composables/useStaticBucketFile";
import StaticBucketTreeNode from "./StaticBucketTreeNode.vue";
import type { TreeNode } from "./StaticBucketTreeNode.vue";

const props = defineProps<{
  bucketName: string;
  files: BucketFile[];
  loading?: boolean;
  savingFile?: boolean;
  deletingPath?: string | null;
}>();

const emit = defineEmits<{
  back: [];
  uploadFile: [];
  uploadDir: [];
  downloadZip: [];
  downloadFile: [path: string];
  deleteFile: [path: string];
  readFile: [path: string];
  saveFile: [path: string, content: string];
  replaceFile: [path: string, base64: string];
  renameFile: [from: string, to: string];
}>();

const themeStore = useThemeStore();
const selectedPath = ref<string | null>(null);
const fileContent = ref("");
const editedContent = ref("");
const fileLoading = ref(false);
const fileError = ref<string | null>(null);
const fileUnsupported = ref(false);
const fileUploadRef = ref<HTMLInputElement | null>(null);

const isDirty = computed(() => editedContent.value !== fileContent.value);

const editorExtensions = computed((): CMExtension[] => {
  const ext = (selectedPath.value ?? "").split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, () => CMExtension> = {
    json: () => json(),
    js: () => StreamLanguage.define(javascript),
    mjs: () => StreamLanguage.define(javascript),
    ts: () => StreamLanguage.define(javascript),
    css: () => StreamLanguage.define(css),
    html: () => StreamLanguage.define(xml),
    xml: () => StreamLanguage.define(xml),
    svg: () => StreamLanguage.define(xml),
  };
  const lang = langMap[ext]?.();
  return [...(lang ? [lang] : []), ...(themeStore.isDark ? [oneDark] : [])];
});

const buildTree = (files: BucketFile[]): TreeNode[] => {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      if (isLast) {
        current.push({
          name: part,
          path: file.path,
          isDir: false,
          size: file.size,
          mtime: file.mtime,
        });
      } else {
        let dir = current.find((n) => n.name === part && n.isDir);
        if (!dir) {
          dir = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.push(dir);
        }
        current = dir.children!;
      }
    }
  }
  return root;
};

const fileTree = computed(() => buildTree(props.files));

const selectFile = (path: string) => {
  selectedPath.value = path;
  fileContent.value = "";
  editedContent.value = "";
  fileError.value = null;
  fileUnsupported.value = false;
  fileLoading.value = true;
  emit("readFile", path);
};

watch(
  () => props.files,
  (files) => {
    if (selectedPath.value === null && files.length > 0) {
      selectFile(files[0]!.path);
    }
  },
  { immediate: true },
);

const onFileContentLoaded = (content: string) => {
  fileContent.value = content;
  editedContent.value = content;
  fileLoading.value = false;
};

const onFileContentUnsupported = () => {
  fileUnsupported.value = true;
  fileLoading.value = false;
};

const onFileContentError = (msg: string) => {
  fileError.value = msg;
  fileLoading.value = false;
};

const handleSave = () => {
  if (!selectedPath.value) return;
  emit("saveFile", selectedPath.value, editedContent.value);
};

const handleReplaceFile = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !selectedPath.value) return;
  (e.target as HTMLInputElement).value = "";
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result as string).split(",")[1] ?? "";
    emit("replaceFile", selectedPath.value!, base64);
  };
  reader.readAsDataURL(file);
};

const handleRename = (from: string, to: string) => {
  if (selectedPath.value === from) selectedPath.value = to;
  emit("renameFile", from, to);
};

const handleRootDrop = (e: DragEvent) => {
  e.preventDefault();
  const fromPath = e.dataTransfer?.getData("text/plain");
  if (!fromPath) return;
  const fileName = fromPath.split("/").pop()!;
  if (fromPath === fileName) return;
  handleRename(fromPath, fileName);
};

defineExpose({
  onFileContentLoaded,
  onFileContentUnsupported,
  onFileContentError,
});

const isDraggingAny = ref(false);
provide("dragging", isDraggingAny);
</script>

<template>
  <div class="h-full flex flex-col space-y-3">
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" @click="emit('back')">
        <ArrowLeft class="h-4 w-4 mr-1" />
        返回
      </Button>
      <span class="text-sm text-muted-foreground">
        Bucket
        <span class="font-mono font-medium text-foreground">{{
          bucketName
        }}</span>
        · {{ files.length }} 个文件
      </span>
      <div class="flex-1" />
      <Button variant="outline" size="sm" @click="emit('downloadZip')">
        <Archive class="h-4 w-4 mr-1" />
        下载压缩包
      </Button>
      <Button variant="outline" size="sm" @click="emit('uploadDir')">
        <Upload class="h-4 w-4 mr-1" />
        上传本地目录
      </Button>
      <Button size="sm" @click="emit('uploadFile')">
        <Upload class="h-4 w-4 mr-1" />
        上传本地文件
      </Button>
    </div>

    <div class="flex-1 grid grid-cols-3 gap-3 min-h-0">
      <div class="col-span-1 rounded-lg border p-3 flex flex-col min-h-0">
        <p class="text-xs font-medium text-muted-foreground mb-2 shrink-0">
          文件树
        </p>
        <div
          v-if="loading && files.length === 0"
          class="text-xs text-muted-foreground text-center py-4"
        >
          加载中...
        </div>
        <div
          v-else-if="!loading && files.length === 0"
          class="text-xs text-muted-foreground italic text-center py-4"
        >
          暂无文件
        </div>
        <div
          v-else
          class="flex-1 overflow-y-auto flex flex-col min-h-0"
          @dragover.prevent
          @drop="handleRootDrop"
        >
          <TransitionGroup
            name="tree-item"
            tag="div"
            class="flex flex-col gap-0.5 relative"
          >
            <StaticBucketTreeNode
              v-for="node in fileTree"
              :key="node.path"
              :node="node"
              :selected="selectedPath"
              :deleting-path="deletingPath ?? null"
              @select="selectFile"
              @delete="(p: string) => emit('deleteFile', p)"
              @download="(p: string) => emit('downloadFile', p)"
              @rename="handleRename"
            />
          </TransitionGroup>
        </div>
      </div>

      <div class="col-span-2 rounded-lg border p-3 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-2 shrink-0">
          <p class="text-xs font-medium text-muted-foreground">文件内容</p>
          <div
            v-if="selectedPath && !fileLoading && !fileError"
            class="flex gap-1"
          >
            <input
              ref="fileUploadRef"
              type="file"
              class="hidden"
              @change="handleReplaceFile"
            />
            <Button
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="fileUploadRef?.click()"
            >
              <Upload class="h-3 w-3 mr-1" />上传替换
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              :disabled="!isDirty || savingFile"
              @click="handleSave"
            >
              <Loader2 v-if="savingFile" class="h-3 w-3 mr-1 animate-spin" />
              <Save v-else class="h-3 w-3 mr-1" />
              保存
            </Button>
          </div>
        </div>

        <div
          v-if="!selectedPath"
          class="text-xs text-muted-foreground italic text-center py-8"
        >
          点击左侧文件查看内容
        </div>
        <div
          v-else-if="fileUnsupported"
          class="flex items-center justify-center gap-1 text-xs text-muted-foreground italic py-8"
        >
          <AlertCircle class="h-3 w-3" />不支持预览此类型文件
        </div>
        <div
          v-else-if="fileLoading"
          class="flex items-center gap-2 text-xs text-muted-foreground py-4"
        >
          <Loader2 class="h-3 w-3 animate-spin" />加载中...
        </div>
        <div
          v-else-if="fileError"
          class="flex items-center gap-1 text-xs text-destructive py-4"
        >
          <AlertCircle class="h-3 w-3" />{{ fileError }}
        </div>
        <div v-else class="flex-1 min-h-0 rounded overflow-hidden border">
          <Codemirror v-model="editedContent" :extensions="editorExtensions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  font-size: 12px;
}

/* 根节点列表项出现/消失/移动 */
.tree-item-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.tree-item-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  position: absolute;
  width: 100%;
}
.tree-item-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.tree-item-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
.tree-item-move {
  transition: transform 0.2s ease;
}
</style>
