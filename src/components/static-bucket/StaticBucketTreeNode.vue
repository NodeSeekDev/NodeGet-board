<script setup lang="ts">
import { ref, watch, inject } from "vue";
import type { Ref } from "vue";
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  Download,
  Loader2,
  Trash2,
} from "lucide-vue-next";
import { PopConfirm } from "@/components/ui/pop-confirm";

export type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  size?: number;
  mtime?: number;
};

defineOptions({ name: "StaticBucketTreeNode" });

const props = defineProps<{
  node: TreeNode;
  selected: string | null;
  deletingPath: string | null;
}>();

const emit = defineEmits<{
  select: [path: string];
  delete: [path: string];
  download: [path: string];
  rename: [from: string, to: string];
}>();

const isDraggingAny = inject<Ref<boolean>>("dragging", ref(false));

const expanded = ref(true);
const isDragOver = ref(false);
const isDragging = ref(false);

watch(isDraggingAny, (val) => {
  if (!val) isDragOver.value = false;
});

const onDirDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = true;
};

const onDirDragLeave = (e: DragEvent) => {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isDragOver.value = false;
  }
};

const onDirDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = false;
  const fromPath = e.dataTransfer?.getData("text/plain");
  if (!fromPath) return;
  const fileName = fromPath.split("/").pop()!;
  const toPath = `${props.node.path}/${fileName}`;
  if (fromPath === toPath) return;
  emit("rename", fromPath, toPath);
};

const onFileDragStart = (e: DragEvent) => {
  e.dataTransfer?.setData("text/plain", props.node.path);
  e.dataTransfer!.effectAllowed = "move";
  e.stopPropagation();
  isDragging.value = true;
  isDraggingAny.value = true;
  document.body.style.cursor = "grabbing";
};

const onFileDragEnd = () => {
  isDragging.value = false;
  isDraggingAny.value = false;
  document.body.style.cursor = "";
};
</script>

<template>
  <div
    v-if="node.isDir"
    class="rounded transition-all"
    :class="isDragOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''"
    @dragover="onDirDragOver"
    @dragleave="onDirDragLeave"
    @drop="onDirDrop"
  >
    <button
      class="flex items-center gap-1 w-full text-left text-xs px-1 py-1 rounded transition-all group"
      :class="isDragOver ? '' : 'hover:bg-muted'"
      @click="expanded = !expanded"
    >
      <ChevronRight
        class="h-3 w-3 transition-all flex-shrink-0"
        :class="[
          isDragOver ? 'text-primary' : 'text-muted-foreground',
          expanded ? 'rotate-90' : '',
        ]"
      />
      <Folder
        class="h-3 w-3 flex-shrink-0 transition-colors"
        :class="
          isDragOver ? 'text-primary fill-primary/20' : 'text-muted-foreground'
        "
      />
      <span
        class="truncate transition-colors"
        :class="isDragOver ? 'text-primary font-medium' : ''"
      >
        {{ node.name }}
      </span>
    </button>
    <Transition name="folder-expand">
      <div v-if="expanded && node.children?.length" class="pl-4 space-y-0.5">
        <StaticBucketTreeNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :selected="selected"
          :deleting-path="deletingPath"
          @select="(p) => emit('select', p)"
          @delete="(p) => emit('delete', p)"
          @download="(p) => emit('download', p)"
          @rename="(from, to) => emit('rename', from, to)"
        />
      </div>
    </Transition>
  </div>

  <div
    v-else
    class="flex items-center gap-1 w-full text-xs px-1 py-1 rounded transition-all group cursor-grab"
    :class="[
      selected === node.path ? 'bg-muted' : 'hover:bg-muted',
      isDragging ? 'opacity-40 scale-[0.98]' : '',
    ]"
    draggable="true"
    @dragstart="onFileDragStart"
    @dragend="onFileDragEnd"
    @dragover.prevent
    @click="emit('select', node.path)"
  >
    <div class="w-3 flex-shrink-0" />
    <FileIcon class="h-3 w-3 text-muted-foreground flex-shrink-0" />
    <span class="truncate flex-1">{{ node.name }}</span>
    <button
      class="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-background transition-opacity flex-shrink-0"
      title="下载"
      @click.stop="emit('download', node.path)"
    >
      <Download class="h-3 w-3" />
    </button>
    <Loader2
      v-if="deletingPath === node.path"
      class="h-3 w-3 animate-spin text-destructive flex-shrink-0"
    />
    <PopConfirm
      v-else
      :description="`确认删除文件「${node.name}」？`"
      confirm-text="删除"
      @confirm="emit('delete', node.path)"
      @click.stop
    >
      <button
        class="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-background text-destructive transition-opacity flex-shrink-0"
        title="删除"
        @click.stop
      >
        <Trash2 class="h-3 w-3" />
      </button>
    </PopConfirm>
  </div>
</template>

<style scoped>
.folder-expand-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.folder-expand-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.folder-expand-enter-from,
.folder-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px) scaleY(0.92);
  transform-origin: top center;
}
</style>
