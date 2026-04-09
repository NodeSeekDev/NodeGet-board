<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  Box,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  RotateCcw,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
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
import ExtensionInstallDialog from "@/components/extensions/ExtensionInstallDialog.vue";
import ExtensionDetail from "@/components/extensions/ExtensionDetail.vue";
import ExtensionIcon from "@/components/extensions/ExtensionIcon.vue";
import { useExtensions } from "@/composables/useExtensions";
import type { Extension } from "@/composables/useExtensions";

definePage({
  meta: {
    title: "router.appPanel",
    icon: Box,
    order: 11,
    group: "router.group.appExtensions",
  },
});

const {
  extensions,
  loading,
  error,
  fetchExtensions,
  toggleExtension,
  deleteExtension,
  installExtension,
  reinstallExtension,
  getStaticUrl,
} = useExtensions();

const installDialogOpen = ref(false);
const installDialogRef = ref<InstanceType<
  typeof ExtensionInstallDialog
> | null>(null);
const reinstallTarget = ref<Extension | null>(null);

const selectedId = ref<string | null>(null);
const selectedExtension = ref<Extension | null>(null);
const deletingId = ref<string | null>(null);

const selectExtension = (ext: Extension) => {
  if (selectedId.value === ext.id) {
    selectedId.value = null;
    selectedExtension.value = null;
    return;
  }
  selectedId.value = ext.id;
  selectedExtension.value = ext;
};

const handleInstall = async (files: File[]) => {
  try {
    const id = await installExtension(files, (msg) => {
      installDialogRef.value?.onProgress(msg);
    });
    installDialogRef.value?.onInstallDone(id);
    await fetchExtensions();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "安装失败";
    installDialogRef.value?.onInstallError(msg);
    toast.error(msg);
  }
};

const handleToggle = async (ext: Extension) => {
  try {
    await toggleExtension(ext.id, !ext.disabled);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "操作失败");
  }
};

const handleDelete = async (ext: Extension) => {
  deletingId.value = ext.id;
  try {
    await deleteExtension(ext.id);
    if (selectedId.value === ext.id) {
      selectedId.value = null;
      selectedExtension.value = null;
    }
    toast.success("扩展已删除");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deletingId.value = null;
  }
};

const handleReinstall = (ext: Extension) => {
  reinstallTarget.value = ext;
  installDialogOpen.value = true;
};

const handleReinstallConfirm = async (target: Extension, files: File[]) => {
  try {
    await reinstallExtension(target, files, (msg) => {
      installDialogRef.value?.onProgress(msg);
    });
    installDialogRef.value?.onInstallDone(target.id);
    await fetchExtensions();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "重装失败";
    installDialogRef.value?.onInstallError(msg);
    toast.error(msg);
  }
};

const handleDeleted = () => {
  selectedId.value = null;
  selectedExtension.value = null;
  fetchExtensions();
};

const handleUpdated = (ext: Extension) => {
  selectedExtension.value = ext;
  const idx = extensions.value.findIndex((e) => e.id === ext.id);
  if (idx >= 0) extensions.value[idx] = ext;
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const getIconUrl = (ext: Extension) => {
  if (!ext.app.icon) return null;
  return getStaticUrl(ext.id, ext.app.icon);
};

onMounted(() => fetchExtensions());
</script>

<template>
  <div class="h-full flex flex-col space-y-6 overflow-y-auto">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ $t("router.appPanel") }}
        </h2>
        <p class="text-muted-foreground text-sm">管理已安装的扩展应用</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="fetchExtensions"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </Button>
        <Button size="sm" @click="installDialogOpen = true">
          <Plus class="h-4 w-4 mr-1" />
          添加 Extension
        </Button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <!-- 扩展列表 -->
    <div class="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-12">icon</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>添加时间</TableHead>
            <TableHead class="w-20">启用</TableHead>
            <TableHead class="w-28">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && extensions.length === 0">
            <TableRow>
              <TableCell
                colspan="7"
                class="text-center text-muted-foreground py-8"
              >
                加载中...
              </TableCell>
            </TableRow>
          </template>
          <template v-else-if="extensions.length === 0">
            <TableRow>
              <TableCell
                colspan="7"
                class="text-center text-muted-foreground py-8"
              >
                暂无已安装的扩展，点击「添加 Extension」开始使用
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <template v-for="ext in extensions" :key="ext.id">
              <TableRow :class="{ 'bg-muted/30': selectedId === ext.id }">
                <!-- icon -->
                <TableCell>
                  <div
                    class="w-8 h-8 rounded border bg-muted/40 flex items-center justify-center overflow-hidden"
                  >
                    <ExtensionIcon :url="getIconUrl(ext)" :size="20" />
                  </div>
                </TableCell>

                <!-- 名称 -->
                <TableCell class="font-medium">{{ ext.app.name }}</TableCell>

                <!-- ID -->
                <TableCell
                  class="font-mono text-xs text-muted-foreground max-w-32 truncate"
                >
                  {{ ext.id }}
                </TableCell>

                <!-- 版本 -->
                <TableCell class="text-sm">{{
                  ext.app.version || "—"
                }}</TableCell>

                <!-- 添加时间 -->
                <TableCell class="text-sm text-muted-foreground">
                  {{ formatDate(ext.created_at) }}
                </TableCell>

                <!-- 启用 toggle -->
                <TableCell @click.stop>
                  <button
                    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    :class="ext.disabled ? 'bg-input' : 'bg-primary'"
                    @click.stop="handleToggle(ext)"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                      :class="
                        ext.disabled ? 'translate-x-0.5' : 'translate-x-4'
                      "
                    />
                  </button>
                </TableCell>

                <!-- 操作 -->
                <TableCell @click.stop>
                  <div class="flex items-center gap-1">
                    <!-- 删除 -->
                    <PopConfirm
                      title="确认删除"
                      :description="`删除扩展「${ext.app.name}」？`"
                      @confirm="handleDelete(ext)"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-7 w-7"
                        :disabled="deletingId === ext.id"
                      >
                        <Trash2 class="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </PopConfirm>

                    <!-- 设置（展开详情） -->
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :class="{ 'bg-muted': selectedId === ext.id }"
                      @click.stop="selectExtension(ext)"
                    >
                      <Settings class="h-3.5 w-3.5" />
                    </Button>

                    <!-- 重装 -->
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      @click.stop="handleReinstall(ext)"
                    >
                      <RotateCcw class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              <!-- 展开的详情面板 -->
              <TableRow
                v-if="selectedId === ext.id"
                class="hover:bg-transparent"
              >
                <TableCell colspan="7" class="bg-muted/20 p-6">
                  <ExtensionDetail
                    v-if="selectedExtension"
                    :extension="selectedExtension"
                    @deleted="handleDeleted"
                    @updated="handleUpdated"
                  />
                </TableCell>
              </TableRow>
            </template>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- 安装/重装对话框 -->
    <ExtensionInstallDialog
      ref="installDialogRef"
      :open="installDialogOpen"
      :reinstall-target="reinstallTarget"
      @update:open="
        (v) => {
          installDialogOpen = v;
          if (!v) reinstallTarget = null;
        }
      "
      @install="handleInstall"
      @reinstall="handleReinstallConfirm"
    />
  </div>
</template>
