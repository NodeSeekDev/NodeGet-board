<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Inbox,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Loader2,
} from "lucide-vue-next";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrontabResult } from "@/composables/useCronHistory";

const props = defineProps<{
  records: CrontabResult[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  taskType: "agent" | "server";
}>();

const emit = defineEmits<{
  pageChange: [page: number];
  pageSizeChange: [pageSize: number];
  view: [id: number];
  delete: [id: number];
}>();

const { t } = useI18n();
const pageSizeOptions = [10, 20, 50, 100];

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
</script>

<template>
  <div class="space-y-4">
    <div
      class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col transition-all relative"
    >
      <!-- 有数据时的加载遮罩 -->
      <div
        v-if="loading && records.length"
        class="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex flex-col items-center justify-center"
      >
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <Table>
        <TableHeader class="bg-muted/30">
          <TableRow class="hover:bg-transparent">
            <TableHead class="font-medium whitespace-nowrap">{{
              t("dashboard.cron.history.recordId")
            }}</TableHead>
            <TableHead
              v-if="taskType === 'agent'"
              class="font-medium whitespace-nowrap"
              >{{ t("dashboard.cron.history.taskId") }}</TableHead
            >
            <TableHead class="font-medium whitespace-nowrap">{{
              t("dashboard.cron.history.executionTime")
            }}</TableHead>
            <TableHead class="font-medium whitespace-nowrap">{{
              t("dashboard.cron.history.status")
            }}</TableHead>
            <TableHead class="font-medium max-w-[300px]">{{
              t("dashboard.cron.history.message")
            }}</TableHead>
            <TableHead
              v-if="taskType === 'agent'"
              class="font-medium text-right pr-6"
              >{{ t("dashboard.cron.actions") }}</TableHead
            >
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading && !records.length">
            <TableCell
              :colspan="taskType === 'agent' ? 6 : 4"
              class="h-[300px] text-center"
            >
              <div class="flex flex-col items-center justify-center space-y-3">
                <Loader2
                  class="w-6 h-6 animate-spin text-muted-foreground/50"
                />
                <span class="text-sm font-medium">{{
                  t("common.loading")
                }}</span>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="!records.length">
            <TableCell
              :colspan="taskType === 'agent' ? 6 : 4"
              class="h-[300px] text-center"
            >
              <div
                class="flex flex-col items-center justify-center text-muted-foreground space-y-3"
              >
                <div
                  class="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center"
                >
                  <Inbox class="w-6 h-6 text-muted-foreground/60" />
                </div>
                <p class="text-sm">{{ t("dashboard.cron.history.noData") }}</p>
              </div>
            </TableCell>
          </TableRow>

          <TableRow
            v-for="record in records"
            :key="record.id"
            class="group transition-colors hover:bg-muted/40"
          >
            <TableCell class="font-mono text-sm text-foreground/80 py-3">
              {{ record.id }}
            </TableCell>

            <TableCell
              v-if="taskType === 'agent'"
              class="font-mono text-sm text-foreground/80 py-3"
            >
              <span v-if="record.relative_id">{{ record.relative_id }}</span>
              <span v-else class="text-muted-foreground/50">-</span>
            </TableCell>

            <TableCell class="py-3">
              <div class="flex items-center gap-2 text-sm text-foreground/90">
                <span class="font-mono">{{ formatTime(record.run_time) }}</span>
              </div>
            </TableCell>

            <TableCell class="py-3">
              <div
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                :class="
                  record.success
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                "
              >
                <CheckCircle2 v-if="record.success" class="w-3.5 h-3.5" />
                <XCircle v-else class="w-3.5 h-3.5" />
                {{
                  record.success
                    ? t("dashboard.cron.history.success")
                    : t("dashboard.cron.history.failed")
                }}
              </div>
            </TableCell>

            <TableCell class="py-3 max-w-[300px]">
              <div
                class="text-sm line-clamp-5 break-words whitespace-pre-wrap"
                style="word-break: break-word"
                :class="
                  record.success
                    ? 'text-muted-foreground'
                    : 'text-destructive font-medium'
                "
                :title="record.message"
              >
                {{ record.message }}
              </div>
            </TableCell>

            <TableCell v-if="taskType === 'agent'" class="py-3 text-right pr-4">
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7"
                  @click="emit('view', record.id)"
                >
                  <FileJson class="h-3.5 w-3.5" />
                </Button>
                <PopConfirm
                  :description="t('dashboard.cron.history.deleteConfirm')"
                  @confirm="emit('delete', record.id)"
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    class="h-7 w-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </PopConfirm>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="totalPages > 1 || records.length > 0"
        class="border-t bg-muted/10 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex items-center gap-3 text-sm text-muted-foreground">
          <div class="flex items-center gap-2">
            <span>{{ t("dashboard.cron.history.pageSize") }}</span>
            <Select
              :model-value="String(pageSize)"
              @update:model-value="emit('pageSizeChange', Number($event))"
            >
              <SelectTrigger class="h-8 w-[88px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in pageSizeOptions"
                  :key="option"
                  :value="String(option)"
                >
                  {{ option }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span>{{ totalPages > 0 ? currentPage : 0 }} / {{ totalPages }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-3 shadow-sm bg-background transition-colors hover:bg-muted"
            :disabled="currentPage <= 1 || loading"
            @click="emit('pageChange', currentPage - 1)"
          >
            <ChevronLeft class="w-4 h-4 mr-1" />
            {{ t("common.previous") }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-3 shadow-sm bg-background transition-colors hover:bg-muted"
            :disabled="currentPage >= totalPages || loading"
            @click="emit('pageChange', currentPage + 1)"
          >
            {{ t("common.next") }}
            <ChevronRight class="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
