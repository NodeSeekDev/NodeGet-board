<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, Pencil, Trash2, GripVertical } from "lucide-vue-next";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PopConfirm } from "@/components/ui/pop-confirm";
import type { Script } from "@/composables/useScripts";

const tables = ref<Script[]>([]);

const props = defineProps<{
  scripts: Script[];
  loading?: boolean;
  deletingNames: string[];
  sortable?: boolean;
}>();

const emit = defineEmits<{
  edit: [script: Script];
  delete: [name: string];
  updateOrder: [script: Script];
}>();

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString();
};

const isDeleting = (name: string) => props.deletingNames.includes(name);

watch(
  () => props.scripts,
  () => {
    tables.value = props.scripts.sort((a, b) => a.order - b.order);
  },
);

const updateOrderIfChanged = () => {
  if (!props.scripts || !tables.value) return;

  // 先对 props.scripts 按 order 排序
  const tmpScripts = [...props.scripts].sort((a, b) => a.order - b.order);

  tables.value.forEach((script, index) => {
    const originalIndex = tmpScripts.findIndex((s) => s.name === script.name);
    if (originalIndex !== index) {
      let newOrder: number;

      // 拖到最前
      if (index === 0) {
        const second = tables.value[1];
        newOrder =
          second?.order !== undefined ? second.order - 1 : script.order - 1;
      }
      // 拖到最后
      else if (index === tables.value.length - 1) {
        const penultimate = tables.value[tables.value.length - 2];
        newOrder =
          penultimate?.order !== undefined
            ? penultimate.order + 1
            : script.order + 1;
      }
      // 拖到中间
      else {
        const prev = tables.value[index - 1];
        const next = tables.value[index + 1];
        const prevOrder = prev?.order ?? script.order - 1;
        const nextOrder = next?.order ?? script.order + 1;
        newOrder = (prevOrder + nextOrder) / 2;
      }

      // 如果 order 发生变化，触发 emit
      if (newOrder !== script.order) {
        script.order = newOrder;
        emit("updateOrder", script);
      }
    }
  });
};

// drag
const onDragStart = (event: DragEvent, index: number) => {
  event.dataTransfer?.setData("text/plain", index.toString());
  event.dataTransfer!.effectAllowed = "move";
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer!.dropEffect = "move";
};

const onDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault();
  const fromIndexStr = event.dataTransfer?.getData("text/plain");
  if (fromIndexStr === undefined || fromIndexStr === null) return;

  const fromIndex = parseInt(fromIndexStr, 10);
  if (isNaN(fromIndex) || fromIndex === targetIndex) return;

  const movedItem: Script = tables.value.splice(fromIndex, 1)[0] as Script;
  tables.value.splice(targetIndex, 0, movedItem);
};

watch(
  () => props.sortable,
  () => {
    if (props.sortable === false) {
      updateOrderIfChanged();
    }
  },
);
</script>

<template>
  <div class="relative w-full">
    <div
      v-if="loading && scripts.length"
      class="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-md"
    >
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="text-center">{{
            $t("dashboard.scripts.order")
          }}</TableHead>
          <TableHead class="text-center">{{
            $t("dashboard.scripts.name")
          }}</TableHead>
          <TableHead class="text-center">{{
            $t("dashboard.scripts.lang")
          }}</TableHead>
          <TableHead class="text-center">{{
            $t("dashboard.scripts.updatedTime")
          }}</TableHead>
          <TableHead>{{ $t("dashboard.scripts.actions") }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loading && !tables.length">
          <TableCell colspan="7" class="h-32 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center space-y-3">
              <Loader2 class="w-6 h-6 animate-spin text-muted-foreground/50" />
              <span class="text-sm font-medium">{{
                $t("common.loading")
              }}</span>
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-else-if="!tables.length">
          <TableCell
            colspan="7"
            class="text-center text-muted-foreground py-12"
          >
            {{ $t("dashboard.cron.empty") }}
          </TableCell>
        </TableRow>
        <TableRow
          v-for="(script, index) in tables"
          :key="script.name"
          :draggable="sortable"
          @dragstart="(e: DragEvent) => onDragStart(e, index)"
          @dragover="onDragOver"
          @drop="(e: DragEvent) => onDrop(e, index)"
          :class="sortable ? 'cursor-move select-none' : ''"
        >
          <TableCell class="text-center">
            <div class="flex items-center justify-center">
              <GripVertical class="h-4 w-4 mr-1" v-show="sortable" />
              <span>{{ index + 1 }}</span>
            </div>
          </TableCell>
          <TableCell class="font-medium text-center">
            {{ script.name }}
          </TableCell>
          <TableCell class="font-medium text-center">
            <Badge variant="secondary">{{ script.lang }}</Badge>
          </TableCell>
          <TableCell class="text-center">{{
            formatTime(script.updated_at)
          }}</TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              @click="emit('edit', script)"
              class="hover:bg-transparent"
            >
              <Pencil class="h-4 w-4" />
            </Button>
            <PopConfirm
              :description="
                $t('dashboard.scripts.deleteConfirm', { name: script.name })
              "
              :loading="isDeleting(script.name)"
              @confirm="emit('delete', script.name)"
            >
              <Button
                size="icon"
                variant="ghost"
                :disabled="isDeleting(script.name)"
                class="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </PopConfirm>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
