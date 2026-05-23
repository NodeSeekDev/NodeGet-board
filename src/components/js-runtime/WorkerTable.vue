<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Pencil, Trash2, Loader2 } from "lucide-vue-next";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PopConfirm } from "@/components/ui/pop-confirm";
import type { JsWorker } from "@/composables/useJsRuntime";

const props = defineProps<{
  workers: JsWorker[];
  loading?: boolean;
  deletingIds: string[];
}>();

const emit = defineEmits<{
  delete: [id: string];
  edit: [worker: JsWorker];
}>();

const { t } = useI18n();
const router = useRouter();

const formatTime = (ts: number | null) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
};

const openDetail = (worker: JsWorker) => {
  void router.push(`/dashboard/js-runtime/${worker.name}`);
};

const isDeleting = (name: string) => props.deletingIds.includes(name);
</script>

<template>
  <div class="relative w-full">
    <div
      v-if="loading && workers.length"
      class="bg-background/40 absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md backdrop-blur-[1px]"
    >
      <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ t("dashboard.jsRuntime.name") }}</TableHead>
          <TableHead>{{ t("dashboard.jsRuntime.route") }}</TableHead>
          <TableHead>{{ t("dashboard.jsRuntime.createdAt") }}</TableHead>
          <TableHead>{{ t("dashboard.jsRuntime.updatedAt") }}</TableHead>
          <TableHead class="text-right">{{ t("dashboard.jsRuntime.actions") }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loading && !workers.length">
          <TableCell colspan="5" class="text-muted-foreground h-32 text-center">
            <div class="flex flex-col items-center justify-center space-y-3">
              <Loader2 class="text-muted-foreground/50 h-6 w-6 animate-spin" />
              <span class="text-sm font-medium">{{ t("common.loading") }}</span>
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-else-if="!workers.length">
          <TableCell colspan="5" class="text-muted-foreground py-12 text-center">
            {{ t("common.noData") }}
          </TableCell>
        </TableRow>
        <TableRow v-for="worker in workers" :key="worker.id">
          <TableCell
            class="text-primary cursor-pointer font-medium hover:underline"
            @click="openDetail(worker)"
          >
            {{ worker.name }}
          </TableCell>
          <TableCell class="py-0 font-mono text-sm">
            <Button
              v-if="worker.route"
              variant="link"
              class="text-primary h-auto p-0 font-mono hover:underline"
              @click="router.push(`/dashboard/worker-route-preview?route=${worker.route}`)"
            >
              {{ worker.route }}
            </Button>
            <span v-else class="text-muted-foreground">-</span>
          </TableCell>
          <TableCell class="text-muted-foreground text-sm">{{
            formatTime(worker.created_at)
          }}</TableCell>
          <TableCell class="text-muted-foreground text-sm">{{
            formatTime(worker.updated_at)
          }}</TableCell>
          <TableCell class="text-right">
            <div class="flex items-center justify-end gap-1">
              <Button size="icon" variant="ghost" class="h-8 w-8" @click="openDetail(worker)">
                <Pencil class="h-4 w-4" />
              </Button>
              <PopConfirm
                :description="t('dashboard.jsRuntime.deleteConfirm', { name: worker.name })"
                @confirm="emit('delete', worker.name)"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  :disabled="isDeleting(worker.name)"
                >
                  <Loader2 v-if="isDeleting(worker.name)" class="h-4 w-4 animate-spin" />
                  <Trash2 v-else class="h-4 w-4" />
                </Button>
              </PopConfirm>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
