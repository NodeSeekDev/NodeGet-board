<script setup lang="ts">
import { ref, computed } from "vue";
import { Trash2, Plus, Search, Loader2, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { PopConfirm } from "@/components/ui/pop-confirm";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = defineProps<{
  namespaces: string[];
  loading?: boolean;
  deletingNs?: string | null;
}>();

const emit = defineEmits<{
  select: [namespace: string];
  openCreate: [];
  delete: [namespace: string];
  refresh: [];
}>();

const searchQuery = ref("");

const filteredNamespaces = computed(() => {
  if (!searchQuery.value.trim()) return props.namespaces;
  return props.namespaces.filter((ns) =>
    ns.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <div class="relative max-w-xs w-full">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        />
        <Input
          v-model="searchQuery"
          placeholder="搜索命名空间..."
          class="pl-8"
        />
      </div>
      <div class="flex-1" />
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        class="ml-auto mr-2"
        @click="emit('refresh')"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <Button size="sm" @click="emit('openCreate')">
        <Plus class="h-4 w-4 mr-1" />
        创建命名空间
      </Button>
    </div>

    <div v-if="loading" class="text-center py-10 text-muted-foreground">
      加载中...
    </div>
    <div
      v-else-if="filteredNamespaces.length === 0"
      class="text-center py-10 text-muted-foreground"
    >
      暂无命名空间
    </div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead class="w-24 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="ns in filteredNamespaces" :key="ns">
          <TableCell>
            <Button
              variant="link"
              class="p-0 h-auto font-mono"
              @click="emit('select', ns)"
            >
              {{ ns }}
            </Button>
          </TableCell>
          <TableCell class="text-right">
            <div class="flex justify-end gap-1">
              <PopConfirm
                v-if="deletingNs !== ns"
                title="确认删除"
                :description="`删除命名空间「${ns}」后不可恢复`"
                confirm-text="删除"
                @confirm="emit('delete', ns)"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </PopConfirm>
              <Button
                v-else
                variant="ghost"
                size="sm"
                disabled
                class="h-7 w-7 p-0 text-destructive"
              >
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
