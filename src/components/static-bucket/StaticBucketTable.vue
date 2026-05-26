<script setup lang="ts">
import {
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Download,
  Loader2,
  FolderOpen,
  FolderSync,
  Eye,
  ArrowUpRight,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StaticBucket } from "@/composables/useStaticBucket";
import { useBackendStore } from "@/composables/useBackendStore";

const props = defineProps<{
  buckets: StaticBucket[];
  loading?: boolean;
  deletingName?: string | null;
}>();

const emit = defineEmits<{
  select: [name: string];
  create: [];
  uploadDir: [];
  reupload: [name: string];
  downloadZip: [name: string];
  delete: [name: string];
  refresh: [];
  toggleHttpRoot: [bucket: StaticBucket];
  toggleCORS: [bucket: StaticBucket];
  toggleEnable: [bucket: StaticBucket];
}>();

const { currentBackend } = useBackendStore();

function getPrevieLink(bucket: StaticBucket): string {
  if (!currentBackend.value?.url) {
    return "#";
  }
  const url = new URL(currentBackend.value.url);
  const http = url.protocol === "ws:" ? "http:" : "https:";
  if (bucket.is_http_root) {
    return `${http}//${url.host}/`;
  }
  return `${http}//${url.host}/nodeget/static/${bucket.name}/index.html`;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="outline" size="sm" @click="emit('uploadDir')">
        <Upload class="mr-1 h-4 w-4" />
        上传本地目录
      </Button>
      <Button size="sm" @click="emit('create')">
        <Plus class="mr-1 h-4 w-4" />
        创建 Bucket
      </Button>
    </div>

    <div v-if="loading" class="py-10 text-center text-muted-foreground">
      加载中...
    </div>
    <div
      v-else-if="buckets.length === 0"
      class="py-10 text-center text-muted-foreground"
    >
      暂无 Bucket
    </div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Bucket 名称</TableHead>
          <TableHead>挂载路径</TableHead>
          <TableHead class="w-36">http 访问</TableHead>
          <TableHead class="w-36">CORS</TableHead>
          <TableHead class="w-36">root 路由</TableHead>
          <TableHead class="w-32 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="bucket in buckets" :key="bucket.name">
          <TableCell>
            <button
              class="group flex cursor-pointer items-center gap-1.5 text-left font-mono text-sm text-primary"
              @click="emit('select', bucket.name)"
            >
              <FolderOpen class="h-4 w-4 shrink-0" />
              <span class="underline-offset-2 group-hover:underline">{{
                bucket.name
              }}</span>
            </button>
          </TableCell>
          <TableCell>
            <span>{{ bucket.path }}</span>
          </TableCell>
          <!-- HTTP 访问 -->
          <TableCell>
            <div class="flex items-center gap-2">
              <Switch
                :model-value="bucket.enable"
                @update:model-value="emit('toggleEnable', bucket)"
              />
              <span v-if="bucket.enable" class="text-xs text-muted-foreground"
                >启用</span
              >
            </div>
          </TableCell>
          <!-- CORS -->
          <TableCell>
            <div class="flex items-center gap-2">
              <Switch
                :disabled="!bucket.enable"
                :model-value="bucket.cors"
                @update:model-value="emit('toggleCORS', bucket)"
              />
              <span v-if="bucket.cors" class="text-xs text-muted-foreground"
                >启用</span
              >
            </div>
          </TableCell>
          <!-- HTTP 根路由 -->
          <TableCell>
            <div class="flex items-center gap-2">
              <Switch
                :disabled="!bucket.enable"
                :model-value="bucket.is_http_root"
                @update:model-value="emit('toggleHttpRoot', bucket)"
              />
              <span
                v-if="bucket.is_http_root"
                class="text-xs text-muted-foreground"
                >启用</span
              >
            </div>
          </TableCell>
          <TableCell class="text-right">
            <div class="flex justify-end gap-1">
              <a target="_blank" :href="getPrevieLink(bucket)">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0"
                  title="预览"
                >
                  <ArrowUpRight class="h-3.5 w-3.5" />
                </Button>
              </a>

              <!-- 重新上传 -->
              <Button
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0"
                title="重新上传"
                @click="emit('reupload', bucket.name)"
              >
                <FolderSync class="h-3.5 w-3.5" />
              </Button>
              <!-- 下载压缩包 -->
              <Button
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0"
                title="下载为压缩包"
                @click="emit('downloadZip', bucket.name)"
              >
                <Download class="h-3.5 w-3.5" />
              </Button>
              <!-- 删除 -->
              <PopConfirm
                v-if="deletingName !== bucket.name"
                :description="`确认删除 Bucket「${bucket.name}」？`"
                confirm-text="删除"
                @confirm="emit('delete', bucket.name)"
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
