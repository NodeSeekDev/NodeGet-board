<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, Pencil, Trash2 } from "lucide-vue-next";
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

const props = defineProps<{
  scripts: Script[];
  loading?: boolean;
  deletingNames: string[];
}>();

const emit = defineEmits<{
  edit: [task: Script];
  delete: [name: string];
}>();

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString();
};

const isDeleting = (name: string) => props.deletingNames.includes(name);
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
          <TableHead>{{ $t("dashboard.scripts.order") }}</TableHead>
          <TableHead>{{ $t("dashboard.scripts.name") }}</TableHead>
          <TableHead>{{ $t("dashboard.scripts.lang") }}</TableHead>
          <TableHead>{{ $t("dashboard.scripts.updatedTime") }}</TableHead>
          <TableHead>{{ $t("dashboard.scripts.actions") }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loading && !scripts.length">
          <TableCell colspan="7" class="h-32 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center space-y-3">
              <Loader2 class="w-6 h-6 animate-spin text-muted-foreground/50" />
              <span class="text-sm font-medium">{{
                $t("common.loading")
              }}</span>
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-else-if="!scripts.length">
          <TableCell
            colspan="7"
            class="text-center text-muted-foreground py-12"
          >
            {{ $t("dashboard.cron.empty") }}
          </TableCell>
        </TableRow>
        <TableRow v-for="(script, index) in scripts" :key="script.name">
          <TableCell>{{ index + 1 }}</TableCell>
          <TableCell class="font-medium">
            {{ script.name }}
          </TableCell>
          <TableCell class="font-medium">
            {{ script.lang }}
          </TableCell>
          <TableCell>{{ formatTime(script.updated_at) }}</TableCell>
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
