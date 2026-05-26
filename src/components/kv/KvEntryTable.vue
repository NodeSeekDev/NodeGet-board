<script setup lang="ts">
import { Eye, Pencil, Trash2 } from "lucide-vue-next";
import type { KvEntry } from "@/composables/useKv";
import { Button } from "@/components/ui/button";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = defineProps<{
  entries: KvEntry[];
  loading?: boolean;
  showNamespace?: boolean;
}>();

const emit = defineEmits<{
  view: [key: string];
  edit: [key: string];
  delete: [key: string];
}>();

const truncate = (val: unknown, len = 80): string => {
  if (val === undefined) return "—";
  const str = JSON.stringify(val);
  return str.length > len ? str.substring(0, len) + "…" : str;
};
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-10 text-muted-foreground">
      加载中...
    </div>
    <div
      v-else-if="entries.length === 0"
      class="text-center py-10 text-muted-foreground"
    >
      暂无数据
    </div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead v-if="showNamespace">Namespace</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead class="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="entry in entries"
          :key="
            (entry as any).namespace
              ? `${(entry as any).namespace}:${entry.key}`
              : entry.key
          "
        >
          <TableCell v-if="showNamespace" class="font-mono text-sm">
            {{ (entry as any).namespace }}
          </TableCell>
          <TableCell class="font-mono text-sm font-medium">{{
            entry.key
          }}</TableCell>
          <TableCell
            class="font-mono text-sm text-muted-foreground max-w-xs truncate"
          >
            {{ truncate(entry.value) }}
          </TableCell>
          <TableCell class="text-right">
            <div class="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="emit('view', entry.key)"
                ><Eye class="h-4 w-4"
              /></Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="emit('edit', entry.key)"
                ><Pencil class="h-4 w-4"
              /></Button>
              <PopConfirm
                title="确认删除"
                :description="`删除 key「${entry.key}」后不可恢复`"
                confirm-text="删除"
                @confirm="emit('delete', entry.key)"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive"
                  ><Trash2 class="h-4 w-4"
                /></Button>
              </PopConfirm>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
