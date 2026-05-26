<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Loader2, AlertCircle } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { bufToBase64 } from "@/utils/base64";
import { useStaticBucket } from "@/composables/useStaticBucket";
import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import {
  useThemeBucketUpload,
  type KeepPolicy,
  type UploadEntry,
  DEFAULT_KEEP_POLICY,
} from "@/composables/useThemeBucketUpload";
import { useThemeTokenPresets } from "@/composables/useThemeTokenPresets";

export type TokenPresetChoice = "monitor_only" | "monitor_ping" | "none";

const props = defineProps<{
  open: boolean;
  initialUrl?: string;
  targetBucket?: string | null;
  autoEnable?: boolean;
  tokenPreset?: TokenPresetChoice;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
  "update:autoEnable": [value: boolean];
  "update:tokenPreset": [value: TokenPresetChoice];
}>();

const sb = useStaticBucket();
const sbf = useStaticBucketFile();
const { uploadToBucket } = useThemeBucketUpload();
const { loadOrInitPresets } = useThemeTokenPresets();

type Step =
  | "idle"
  | "fetching-meta"
  | "creating-bucket"
  | "fetching-files"
  | "uploading"
  | "applying-preset"
  | "enabling"
  | "done"
  | "error";

const urlInput = ref("");
const step = ref<Step>("idle");
const errorMsg = ref<string | null>(null);
const progress = ref({ current: 0, total: 0 });
const detectedThemeName = ref<string | null>(null);
const isUpdate = ref(false);

const keepPolicy = ref<KeepPolicy>({ ...DEFAULT_KEEP_POLICY });
const autoEnable = ref(true);
const tokenPresetChoice = ref<TokenPresetChoice>("monitor_ping");

const isImporting = computed(
  () =>
    step.value !== "idle" && step.value !== "done" && step.value !== "error",
);

const stepLabel: Record<Step, string> = {
  idle: "",
  "fetching-meta": "正在获取主题信息...",
  "creating-bucket": "正在准备 Bucket...",
  "fetching-files": "正在获取文件列表...",
  uploading: "正在上传文件",
  "applying-preset": "正在应用 Token 预设...",
  enabling: "正在启用主题...",
  done: "导入完成",
  error: "导入失败",
};

watch([() => props.open, () => props.initialUrl], ([open, url], [prevOpen]) => {
  if (open) {
    urlInput.value = url ?? "";
    if (!prevOpen) {
      step.value = "idle";
      errorMsg.value = null;
      progress.value = { current: 0, total: 0 };
      detectedThemeName.value = null;
      isUpdate.value = !!props.targetBucket;
      keepPolicy.value = { ...DEFAULT_KEEP_POLICY };
      autoEnable.value = props.autoEnable ?? true;
      tokenPresetChoice.value = props.tokenPreset ?? "monitor_ping";
    }
  }
});

watch(autoEnable, (val) => emit("update:autoEnable", val));
watch(tokenPresetChoice, (val) => emit("update:tokenPreset", val));

const normalizeFileList = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { path?: unknown }).path === "string"
    ) {
      return (item as { path: string }).path;
    }
    return String(item);
  });
};

const handleImport = async () => {
  if (!urlInput.value.trim()) return;
  errorMsg.value = null;
  step.value = "idle";

  try {
    let baseUrl = urlInput.value.trim();
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = "https://" + baseUrl;
    }
    baseUrl = baseUrl.replace(/\/$/, "");

    step.value = "fetching-meta";
    const metaRes = await fetch(`${baseUrl}/nodeget-theme.json`);
    if (!metaRes.ok)
      throw new Error(`获取主题信息失败：HTTP ${metaRes.status}`);
    const meta = (await metaRes.json()) as Record<string, unknown>;
    const short = meta.short;
    if (typeof short !== "string" || !short) {
      throw new Error("nodeget-theme.json 中缺少 short 字段");
    }
    detectedThemeName.value =
      typeof meta.name === "string" && meta.name ? meta.name : short;
    const bucketName = `theme_${short}`;

    step.value = "creating-bucket";
    isUpdate.value = sb.buckets.value.some((b) => b.name === bucketName);
    if (!isUpdate.value) {
      try {
        await sb.createBucket({
          name: bucketName,
          path: bucketName,
          is_http_root: false,
          cors: true,
          enable: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("already exists")) {
          isUpdate.value = true;
        } else {
          throw e;
        }
      }
    }

    step.value = "fetching-files";
    const filesRes = await fetch(`${baseUrl}/nodeget-theme-files.json`);
    if (!filesRes.ok)
      throw new Error(`获取文件列表失败：HTTP ${filesRes.status}`);
    const rawFileList = await filesRes.json();
    const fileList = normalizeFileList(rawFileList);

    const filesToDownload = fileList.filter(
      (p) =>
        p !== "nodeget-theme.json" &&
        p !== "nodeget-theme-files.json" &&
        !p.includes("..") &&
        !p.startsWith("/"),
    );

    const entries: UploadEntry[] = [
      {
        path: "nodeget-theme.json",
        base64: bufToBase64(
          new TextEncoder().encode(JSON.stringify(meta, null, 2)),
        ),
      },
      {
        path: "nodeget-theme-files.json",
        base64: bufToBase64(
          new TextEncoder().encode(JSON.stringify(rawFileList, null, 2)),
        ),
      },
    ];
    let downloadFailed = 0;
    for (const filePath of filesToDownload) {
      try {
        const fileRes = await fetch(`${baseUrl}/${filePath}`);
        if (fileRes.ok) {
          entries.push({
            path: filePath,
            base64: bufToBase64(await fileRes.arrayBuffer()),
          });
        } else {
          downloadFailed++;
        }
      } catch {
        downloadFailed++;
      }
    }

    step.value = "uploading";
    progress.value = { current: 0, total: entries.length };

    const { failedCount: uploadFailed } = await uploadToBucket({
      bucketName,
      files: entries,
      isUpdate: isUpdate.value,
      keepPolicy: keepPolicy.value,
      onProgress: (current, total) => {
        progress.value = { current, total };
      },
    });

    const failedCount = downloadFailed + uploadFailed;

    if (!isUpdate.value) {
      if (tokenPresetChoice.value !== "none") {
        step.value = "applying-preset";
        try {
          const presets = await loadOrInitPresets();
          const targetName =
            tokenPresetChoice.value === "monitor_ping"
              ? "本机 监控+ping"
              : "本机 纯监控";
          const preset = presets.find((p) => p.name === targetName);
          if (preset) {
            const configText = await sbf.readTextFile(
              bucketName,
              "config.json",
            );
            if (!configText) {
              toast.warning("Token 预设应用失败：未能读取主题配置文件");
            } else {
              const config = JSON.parse(configText) as Record<string, unknown>;
              config.site_tokens = [
                {
                  name: preset.name,
                  backend_url: preset.backend_url,
                  token: preset.token,
                },
              ];
              await sbf.saveTextFile(
                bucketName,
                "config.json",
                JSON.stringify(config, null, 2),
              );
            }
          }
        } catch (e) {
          toast.warning(
            `Token 预设应用失败：${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (autoEnable.value) {
        step.value = "enabling";
        try {
          await sb.updateBucket({
            name: bucketName,
            path: bucketName,
            is_http_root: true,
            cors: true,
            enable: true,
          });
        } catch (e) {
          toast.warning(
            `自动启用失败：${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    step.value = "done";
    emit("done");
    emit("update:open", false);
    const action = isUpdate.value ? "更新" : "导入";
    if (failedCount > 0) {
      toast.warning(
        `主题「${detectedThemeName.value}」${action}完成，${failedCount} 个文件下载失败`,
      );
    } else {
      toast.success(`主题「${detectedThemeName.value}」${action}成功`);
    }
  } catch (e: unknown) {
    step.value = "error";
    errorMsg.value = e instanceof Error ? e.message : String(e);
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          targetBucket ? "从远程更新主题" : "从远程导入主题"
        }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-1.5">
          <Label for="remote-url">主题站点 URL</Label>
          <Input
            id="remote-url"
            v-model="urlInput"
            placeholder="example.com 或 https://example.com"
            :disabled="isImporting"
          />
          <p class="text-xs text-muted-foreground">
            将自动拉取该站点的 nodeget-theme.json 和 nodeget-theme-files.json
          </p>
        </div>

        <div
          v-if="!targetBucket"
          class="overflow-hidden rounded-md border text-sm"
        >
          <div class="bg-muted px-3 py-1.5 text-xs font-medium">安装选项</div>
          <div class="divide-y">
            <div class="flex items-center justify-between px-3 py-2">
              <span>安装后自动启用</span>
              <Switch v-model:modelValue="autoEnable" :disabled="isImporting" />
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>Token 预设</span>
              <RadioGroup
                v-model="tokenPresetChoice"
                :disabled="isImporting"
                class="flex items-center gap-4"
              >
                <div class="flex items-center gap-1.5">
                  <RadioGroupItem
                    id="preset-monitor-only"
                    value="monitor_only"
                  />
                  <Label
                    for="preset-monitor-only"
                    class="cursor-pointer font-normal"
                    >纯监控</Label
                  >
                </div>
                <div class="flex items-center gap-1.5">
                  <RadioGroupItem
                    id="preset-monitor-ping"
                    value="monitor_ping"
                  />
                  <Label
                    for="preset-monitor-ping"
                    class="cursor-pointer font-normal"
                    >监控+ping</Label
                  >
                </div>
                <div class="flex items-center gap-1.5">
                  <RadioGroupItem id="preset-none" value="none" />
                  <Label for="preset-none" class="cursor-pointer font-normal"
                    >不使用预设</Label
                  >
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <div
          v-if="targetBucket"
          class="overflow-hidden rounded-md border text-sm"
        >
          <div class="bg-muted px-3 py-1.5 text-xs font-medium">更新选项</div>
          <div class="divide-y">
            <div class="flex items-center justify-between px-3 py-2">
              <span>主题配置（user_preferences）</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-userPrefs"
                    value="old"
                    v-model="keepPolicy.userPrefs"
                    :disabled="isImporting"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-userPrefs"
                    value="new"
                    v-model="keepPolicy.userPrefs"
                    :disabled="isImporting"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>Token（site_tokens）</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-siteTokens"
                    value="old"
                    v-model="keepPolicy.siteTokens"
                    :disabled="isImporting"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-siteTokens"
                    value="new"
                    v-model="keepPolicy.siteTokens"
                    :disabled="isImporting"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>自定义 CSS</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-css"
                    value="old"
                    v-model="keepPolicy.css"
                    :disabled="isImporting"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-css"
                    value="new"
                    v-model="keepPolicy.css"
                    :disabled="isImporting"
                  />
                  采用新配置
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
              <span>自定义 JS</span>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-js"
                    value="old"
                    v-model="keepPolicy.js"
                    :disabled="isImporting"
                  />
                  保留旧配置
                </label>
                <label class="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="ri-keep-js"
                    value="new"
                    v-model="keepPolicy.js"
                    :disabled="isImporting"
                  />
                  采用新配置
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="detectedThemeName && isImporting"
          class="rounded-md bg-muted px-3 py-2 text-sm"
        >
          主题：<span class="font-medium">{{ detectedThemeName }}</span>
        </div>

        <div v-if="isImporting" class="space-y-2">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 shrink-0 animate-spin" />
            <span>
              {{ stepLabel[step] }}
              <template v-if="step === 'uploading'">
                （{{ progress.current }} / {{ progress.total }}）
              </template>
            </span>
          </div>
          <div
            v-if="step === 'uploading' && progress.total > 0"
            class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              class="h-full bg-primary transition-all"
              :style="{
                width: `${(progress.current / progress.total) * 100}%`,
              }"
            />
          </div>
        </div>

        <div
          v-if="step === 'error' && errorMsg"
          class="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ errorMsg }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isImporting"
          @click="$emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          :disabled="!urlInput.trim() || isImporting"
          @click="handleImport"
        >
          <Loader2 v-if="isImporting" class="mr-1 h-4 w-4 animate-spin" />
          导入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
