<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  Palette,
  Upload,
  Download,
  Trash2,
  Settings2,
  Link,
  Loader2,
  RefreshCw,
  FolderOpen,
  ArrowUpRight,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { PopConfirm } from "@/components/ui/pop-confirm";
import { useStaticBucket } from "@/composables/useStaticBucket";
import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { base64ToBuf } from "@/utils/base64";
import type { StaticBucket } from "@/composables/useStaticBucket";
import ThemeTokenPresetDialog from "@/components/theme-management/ThemeTokenPresetDialog.vue";
import ThemeUploadLocalDialog from "@/components/theme-management/ThemeUploadLocalDialog.vue";
import ThemeRemoteImportDialog, {
  type TokenPresetChoice,
} from "@/components/theme-management/ThemeRemoteImportDialog.vue";

definePage({
  meta: {
    title: "router.themeManagement",
    icon: Palette,
    order: 8,
    group: "router.group.appExtensions",
  },
});

const router = useRouter();
const route = useRoute();
const staticBucket = useStaticBucket();
const bucketFile = useStaticBucketFile();
const backendStore = useBackendStore();

const backendUrl = computed(() => backendStore.currentBackend.value?.url ?? "");
const backendToken = computed(
  () => backendStore.currentBackend.value?.token ?? "",
);

const tokenPresetOpen = ref(false);
const uploadLocalOpen = ref(false);
const remoteImportOpen = ref(false);
const remoteImportInitialUrl = ref("");
const remoteImportTarget = ref<string | null>(null);
const remoteImportAutoEnable = ref(true);
const remoteImportTokenPreset = ref<TokenPresetChoice>("monitor_ping");
const uploadLocalTarget = ref<string | null>(null);
const togglingBucket = ref<string | null>(null);
const deletingBucket = ref<string | null>(null);

const themeBuckets = computed<StaticBucket[]>(() =>
  staticBucket.buckets.value.filter((b) => b.name.startsWith("theme_")),
);

type ThemeMeta = {
  name?: string;
  author?: string;
  version?: string;
  dist_page?: string;
};
const themeMetaMap = ref<Record<string, ThemeMeta>>({});
const metaLoading = ref(false);

const loadThemeMetas = async () => {
  if (!backendUrl.value || !themeBuckets.value.length) return;
  metaLoading.value = true;
  try {
    const conn = getWsConnection(backendUrl.value);
    const results = await conn.callBatch<string | null>(
      themeBuckets.value.map((b) => ({
        method: "static-bucket-file_read",
        params: {
          token: backendToken.value,
          name: b.name,
          path: "nodeget-theme.json",
        },
      })),
    );
    const map: Record<string, ThemeMeta> = {};
    themeBuckets.value.forEach((b, i) => {
      try {
        const raw = results[i];
        const text = raw ? new TextDecoder().decode(base64ToBuf(raw)) : null;
        map[b.name] = text ? (JSON.parse(text) as ThemeMeta) : {};
      } catch {
        map[b.name] = {};
      }
    });
    themeMetaMap.value = map;
  } catch {
  } finally {
    metaLoading.value = false;
  }
};

const getThemeName = (bucketName: string) =>
  themeMetaMap.value[bucketName]?.name ?? bucketName.replace(/^theme_/, "");
const getAuthor = (bucketName: string) =>
  themeMetaMap.value[bucketName]?.author ?? "—";
const getVersion = (bucketName: string) =>
  themeMetaMap.value[bucketName]?.version ?? "—";

onMounted(async () => {
  await staticBucket.fetchList();
  loadThemeMetas();

  const addUrl = route.query.add;
  if (typeof addUrl === "string" && addUrl) {
    remoteImportInitialUrl.value = addUrl;

    const autoEnableParam = route.query.auto_enable;
    remoteImportAutoEnable.value =
      autoEnableParam !== "0" && autoEnableParam !== "false";

    const tokenPresetParam = route.query.token_preset;
    const validPresets: TokenPresetChoice[] = [
      "monitor_only",
      "monitor_ping",
      "none",
    ];
    remoteImportTokenPreset.value = validPresets.includes(
      tokenPresetParam as TokenPresetChoice,
    )
      ? (tokenPresetParam as TokenPresetChoice)
      : "monitor_ping";

    remoteImportOpen.value = true;
  }
});

watch(themeBuckets, () => loadThemeMetas());

const handleToggleEnabled = async (bucket: StaticBucket) => {
  togglingBucket.value = bucket.name;
  try {
    if (!bucket.is_http_root) {
      await staticBucket.enableTheme(bucket.name);
      toast.success(`已启用主题「${getThemeName(bucket.name)}」`);
    } else {
      await staticBucket.disableTheme(bucket.name);
      toast.success(`已禁用主题「${getThemeName(bucket.name)}」`);
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    togglingBucket.value = null;
  }
};

const handleDelete = async (name: string) => {
  deletingBucket.value = name;
  try {
    await staticBucket.deleteBucket(name);
    const { [name]: _, ...rest } = themeMetaMap.value;
    themeMetaMap.value = rest;
    toast.success(`主题「${getThemeName(name)}」已删除`);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deletingBucket.value = null;
  }
};

const openRemoteUpdate = (bucket: StaticBucket) => {
  const distPage = themeMetaMap.value[bucket.name]?.dist_page;
  if (!distPage) {
    toast.warning("该主题未记录来源 URL，请手动填写");
  }
  remoteImportInitialUrl.value = distPage ?? "";
  remoteImportTarget.value = bucket.name;
  remoteImportOpen.value = true;
};

const openUploadLocal = (targetBucket: string | null = null) => {
  uploadLocalTarget.value = targetBucket;
  uploadLocalOpen.value = true;
};

const onUploadDone = async () => {
  await staticBucket.fetchList();
};

watch([remoteImportAutoEnable, remoteImportTokenPreset], ([ae, tp]) => {
  if (!remoteImportOpen.value || remoteImportTarget.value) return;
  router.replace({
    query: {
      ...route.query,
      auto_enable: ae ? undefined : "0",
      token_preset: tp === "monitor_ping" ? undefined : tp,
    },
  });
});

const downloadBucketZip = bucketFile.downloadBucketZip;

function getPrevieLink(bucket: StaticBucket): string {
  if (!backendStore.currentBackend.value?.url) {
    return "#";
  }
  const url = new URL(backendStore.currentBackend.value.url);
  const http = url.protocol === "ws:" ? "http:" : "https:";
  if (bucket.is_http_root) {
    return `${http}//${url.host}/`;
  }
  return `${http}//${url.host}/nodeget/static/${bucket.name}/index.html`;
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">主题管理</h1>
        <p class="text-sm text-muted-foreground mt-0.5">列表</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="tokenPresetOpen = true">
          <Settings2 class="h-4 w-4 mr-1.5" />
          Token 预设
        </Button>
        <Button variant="outline" size="sm" @click="openUploadLocal(null)">
          <Upload class="h-4 w-4 mr-1.5" />
          从本地上传
        </Button>
        <Button
          variant="outline"
          size="sm"
          @click="
            remoteImportTarget = null;
            remoteImportAutoEnable = true;
            remoteImportTokenPreset = 'monitor_ping';
            remoteImportOpen = true;
          "
        >
          <Link class="h-4 w-4 mr-1.5" />
          从远程导入
        </Button>
      </div>
    </div>

    <div class="border rounded-lg overflow-hidden">
      <div
        class="grid grid-cols-[2fr_1fr_5rem_1fr_13rem] gap-4 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b"
      >
        <span>名称</span>
        <span>作者</span>
        <span>是否启用</span>
        <span>版本</span>
        <span>操作</span>
      </div>

      <div
        v-if="staticBucket.loading.value"
        class="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2"
      >
        <span
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
        />
        加载中...
      </div>

      <div
        v-else-if="!themeBuckets.length"
        class="flex flex-col items-center justify-center py-12 text-muted-foreground"
      >
        <Palette class="h-10 w-10 mb-3 opacity-30" />
        <p class="text-sm">暂无主题，点击「从本地上传」添加</p>
      </div>

      <template v-else>
        <div
          v-for="bucket in themeBuckets"
          :key="bucket.name"
          class="grid grid-cols-[2fr_1fr_5rem_1fr_13rem] gap-4 px-4 py-3 items-center border-b last:border-0 hover:bg-muted/20 transition-colors"
        >
          <div class="min-w-0">
            <button
              class="text-sm font-medium hover:underline cursor-pointer truncate text-left w-full"
              @click="router.push(`/dashboard/theme/${bucket.name}`)"
            >
              {{ getThemeName(bucket.name) }}
            </button>
          </div>

          <span class="text-sm text-muted-foreground">
            <Loader2 v-if="metaLoading" class="h-3 w-3 animate-spin inline" />
            <template v-else>{{ getAuthor(bucket.name) }}</template>
          </span>

          <div>
            <button
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="bucket.is_http_root ? 'bg-primary' : 'bg-input'"
              :disabled="togglingBucket === bucket.name"
              @click="handleToggleEnabled(bucket)"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                :class="
                  bucket.is_http_root ? 'translate-x-4' : 'translate-x-0.5'
                "
              />
            </button>
          </div>

          <span class="text-sm text-muted-foreground">
            <Loader2 v-if="metaLoading" class="h-3 w-3 animate-spin inline" />
            <template v-else>{{ getVersion(bucket.name) }}</template>
          </span>

          <div class="flex items-center gap-0.5">
            <a target="_blank" :href="getPrevieLink(bucket)">
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                title="预览"
                :disabled="metaLoading"
              >
                <ArrowUpRight class="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="从远程更新"
              :disabled="metaLoading"
              @click="openRemoteUpdate(bucket)"
            >
              <RefreshCw class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="从本地重新上传"
              @click="openUploadLocal(bucket.name)"
            >
              <Upload class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="下载压缩包"
              @click="downloadBucketZip(bucket.name)"
            >
              <Download class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="查看文件"
              @click="router.push(`/dashboard/bucket/${bucket.name}`)"
            >
              <FolderOpen class="h-4 w-4" />
            </Button>
            <PopConfirm
              title="确认删除"
              :description="`删除主题「${getThemeName(bucket.name)}」？此操作不可撤销。`"
              @confirm="handleDelete(bucket.name)"
            >
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-destructive hover:text-destructive"
                :disabled="deletingBucket === bucket.name"
                title="删除主题"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </PopConfirm>
          </div>
        </div>
      </template>
    </div>

    <p v-if="staticBucket.error.value" class="text-sm text-destructive">
      {{ staticBucket.error.value }}
    </p>

    <ThemeTokenPresetDialog v-model:open="tokenPresetOpen" />
    <ThemeUploadLocalDialog
      v-model:open="uploadLocalOpen"
      :target-bucket="uploadLocalTarget"
      @done="onUploadDone"
    />
    <ThemeRemoteImportDialog
      v-model:open="remoteImportOpen"
      :initial-url="remoteImportInitialUrl"
      :target-bucket="remoteImportTarget"
      v-model:auto-enable="remoteImportAutoEnable"
      v-model:token-preset="remoteImportTokenPreset"
      @done="onUploadDone"
    />
  </div>
</template>
