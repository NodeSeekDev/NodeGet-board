<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import {
  Loader2,
  ChevronLeft,
  Play,
  Clock,
  Eye,
  Save,
  Trash2,
  Search,
  RotateCcw,
  FileText,
  ChevronRight,
  Inbox,
} from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useJsRuntime,
  type JsWorker,
  type JsResult,
} from "@/composables/useJsRuntime";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/lib/utils";
import MarkdownIt from "markdown-it";

definePage({
  meta: {
    title: "router.jsRuntimeDetail",
    hidden: true,
  },
});

const route = useRoute("/dashboard/js-runtime/[id]");
const router = useRouter();
const { t } = useI18n();
const runtime = useJsRuntime();
const themeStore = useThemeStore();
const md = new MarkdownIt({ html: false });

const workerId = computed(() => route.params.id);
const worker = ref<JsWorker | null>(null);
const loading = ref(true);
const activeTab = ref("overview");

// Content Tab State
const content = ref("");
const runParams = ref("{}");
const runEnv = ref("{}");
const runResult = ref<any>(null);
const runLoading = ref(false);
const saveLoading = ref(false);
const isPreviewMode = ref(false);
const activeEditorTab = ref("params");
const iframeKey = ref(0);

// Settings Tab State
const envVars = ref<{ key: string; value: string }[]>([]);
const workerRoute = ref("");
const cleanTime = ref("");

// Description State
const descriptionEditOpen = ref(false);
const descriptionEditText = ref("");
const descriptionLoading = ref(false);
const renderedDescription = computed(() => {
  if (!worker.value?.description) return "";
  return md.render(worker.value.description);
});

const openDescriptionEditFun = () => {
  descriptionEditText.value = worker.value?.description || "";
  descriptionEditOpen.value = true;
};

// Logs Tab State
const logsLoading = ref(false);
const allLogs = ref<JsResult[]>([]);
const logDetailOpen = ref(false);
const currentLog = ref<JsResult | null>(null);

const currentPage = ref(1);
const pageSize = ref(10);
const pageSizeOptions = [10, 20, 50, 100];

const logs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return allLogs.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() =>
  Math.ceil(allLogs.value.length / pageSize.value),
);

const logFilter = ref({
  id: "",
  status: "all",
  limit: 20,
  latestOnly: false,
});

const loadLogsFun = async () => {
  if (!worker.value) return;
  logsLoading.value = true;
  try {
    const condition: any[] = [
      { js_worker_name: worker.value.name },
      { limit: Math.max(1, logFilter.value.limit || 20) },
    ];

    if (logFilter.value.id) {
      const id = Number(logFilter.value.id);
      if (!Number.isNaN(id) && id > 0) condition.push({ id });
    }

    if (logFilter.value.status === "success") {
      condition.push({ error_message: null });
    }

    if (logFilter.value.latestOnly) {
      condition.push({ last: null });
    }

    let results = await runtime.getWorkerLogs(condition);

    // JS filter for failed since we aren't sure of backend query condition for IS NOT NULL
    if (logFilter.value.status === "failed") {
      results = results.filter((r) => r.error_message);
    }

    allLogs.value = results;
    currentPage.value = 1;
  } catch (e: any) {
    toast.error(e.message || "Failed to load logs");
  } finally {
    logsLoading.value = false;
  }
};

const resetLogsFilterFun = () => {
  logFilter.value = {
    id: "",
    status: "all",
    limit: 20,
    latestOnly: false,
  };
  loadLogsFun();
};

const deleteLogFun = async (id: number) => {
  if (!confirm(t("dashboard.jsRuntime.logs.deleteConfirm", "Delete this log?")))
    return;
  try {
    await runtime.deleteWorkerLog(id);
    toast.success(t("dashboard.jsRuntime.logs.deleteSuccess", "Log deleted"));
    loadLogsFun();
  } catch (e: any) {
    toast.error(e.message || "Failed to delete log");
  }
};

watch(activeTab, (val) => {
  if (val === "logs") {
    loadLogsFun();
  }
});

const extensions = computed(() => [
  javascript(),
  ...(themeStore.isDark ? [oneDark] : []),
]);

const jsonExtensions = computed(() => [
  json(),
  ...(themeStore.isDark ? [oneDark] : []),
]);

const getWorkerFun = async () => {
  loading.value = true;
  try {
    const data = await runtime.getWorker(workerId.value as string);
    if (data) {
      worker.value = data;
      content.value = data.content;
      workerRoute.value = data.route || "";
      cleanTime.value =
        data.runtime_clean_time != null ? String(data.runtime_clean_time) : "";
      envVars.value = Object.entries(data.env || {}).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      // Always keep one empty row for new env var
      ensureEmptyEnvRow();
    } else {
      toast.error("Worker not found");
      router.push("/dashboard/js-runtime");
    }
  } catch (e: any) {
    toast.error(e.message || "Failed to load worker");
  } finally {
    loading.value = false;
  }
};

const ensureEmptyEnvRow = () => {
  if (
    envVars.value.length === 0 ||
    envVars.value[envVars.value.length - 1]!.key !== "" ||
    envVars.value[envVars.value.length - 1]!.value !== ""
  ) {
    envVars.value.push({ key: "", value: "" });
  }
};

watch(
  envVars,
  () => {
    ensureEmptyEnvRow();
  },
  { deep: true },
);

onMounted(() => {
  getWorkerFun();
});

const syncLatestWorkerState = async (): Promise<JsWorker> => {
  const data = await runtime.getWorker(workerId.value as string);
  if (!data) throw new Error("Worker not found");
  return data;
};

const updateWorkerContentFun = async () => {
  if (!worker.value) return;
  saveLoading.value = true;
  try {
    const latest = await syncLatestWorkerState();

    await runtime.updateWorker(latest.name, {
      content: content.value,
      route: latest.route || "",
      runtime_clean_time: latest.runtime_clean_time,
      env: latest.env || {},
      description: latest.description || "",
    });
    toast.success(t("dashboard.jsRuntime.updateSuccess"));
    worker.value.content = content.value;
  } catch (e: any) {
    toast.error(e.message || "Save failed");
  } finally {
    saveLoading.value = false;
  }
};

const handleJsonParseError = (errorMessage: string): boolean => {
  toast.error(errorMessage);
  runLoading.value = false;
  return false;
};

const runWorkerFun = async (runType: "call" | "cron") => {
  if (!worker.value) return;
  isPreviewMode.value = false;
  runLoading.value = true;
  runResult.value = null;
  try {
    let paramsObj = {};
    let envObj = {};
    try {
      paramsObj = JSON.parse(runParams.value);
    } catch {
      if (!handleJsonParseError("Invalid Params JSON")) return;
    }
    try {
      envObj = JSON.parse(runEnv.value);
    } catch {
      if (!handleJsonParseError("Invalid Env JSON")) return;
    }

    const result = await runtime.runWorker(
      worker.value.name,
      runType,
      paramsObj,
      envObj,
    );

    runResult.value = result;

    // JS execution is asynchronous, poll for the actual result using the returned ID
    if (result && result.id) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const logs = await runtime.getWorkerLogs([{ id: Number(result.id) }]);
        if (logs && logs.length > 0) {
          const log = logs[0];
          if (log) {
            runResult.value = log;
            // If finish_time is present, the script has completed execution
            if (log.finish_time) {
              break;
            }
          }
        }
      }
    }
  } catch (e: any) {
    runResult.value = { error: e.message || "Run failed" };
  } finally {
    runLoading.value = false;
  }
};

const updateWorkerSettingsFun = async () => {
  if (!worker.value) return;
  const envObj: Record<string, string> = {};
  envVars.value.forEach((item) => {
    if (item.key.trim()) {
      envObj[item.key.trim()] = item.value;
    }
  });

  saveLoading.value = true;
  try {
    const latest = await syncLatestWorkerState();

    await runtime.updateWorker(latest.name, {
      route: workerRoute.value,
      runtime_clean_time: cleanTime.value ? Number(cleanTime.value) : null,
      env: envObj,
      content: latest.content,
      description: latest.description || "",
    });
    toast.success(t("dashboard.jsRuntime.updateSuccess"));
    await getWorkerFun();
  } catch (e: any) {
    toast.error(e.message || "Update failed");
  } finally {
    saveLoading.value = false;
  }
};

const updateWorkerDescriptionFun = async () => {
  if (!worker.value) return;
  descriptionLoading.value = true;
  try {
    const latest = await syncLatestWorkerState();

    await runtime.updateWorker(latest.name, {
      content: latest.content,
      route: latest.route || "",
      runtime_clean_time: latest.runtime_clean_time,
      env: latest.env || {},
      description: descriptionEditText.value,
    });
    toast.success("描述更新成功");
    worker.value.description = descriptionEditText.value;
    descriptionEditOpen.value = false;
  } catch (e: any) {
    toast.error(e.message || "Failed to update description");
  } finally {
    descriptionLoading.value = false;
  }
};

const formatTime = (ts: number | null) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
};
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-100px)] space-y-4">
    <div class="flex items-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        @click="router.push('/dashboard/js-runtime')"
      >
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-semibold flex items-center gap-2">
          {{ worker?.name || "Loading..." }}
          <span v-if="loading" class="inline-block animate-spin"
            ><Loader2 class="h-4 w-4"
          /></span>
        </h1>
        <p class="text-muted-foreground font-mono text-xs">{{ workerId }}</p>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
      <TabsList class="w-fit">
        <TabsTrigger value="overview">{{
          t("dashboard.jsRuntime.tabs.overview")
        }}</TabsTrigger>
        <TabsTrigger value="content">{{
          t("dashboard.jsRuntime.tabs.content")
        }}</TabsTrigger>
        <TabsTrigger value="logs">{{
          t("dashboard.jsRuntime.tabs.logs")
        }}</TabsTrigger>
        <TabsTrigger value="settings">{{
          t("dashboard.jsRuntime.tabs.settings")
        }}</TabsTrigger>
      </TabsList>

      <div class="flex-1 mt-4 min-h-0 overflow-auto">
        <TabsContent value="overview" class="m-0">
          <Card>
            <CardHeader>
              <CardTitle>{{
                t("dashboard.jsRuntime.tabs.overview")
              }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <p class="text-sm font-medium text-muted-foreground">
                    {{ t("dashboard.jsRuntime.overview.name") }}
                  </p>
                  <p>{{ worker?.name }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-muted-foreground">
                    {{ t("dashboard.jsRuntime.overview.id") }}
                  </p>
                  <p class="font-mono">{{ worker?.id }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-muted-foreground">
                    {{ t("dashboard.jsRuntime.overview.createdAt") }}
                  </p>
                  <p>{{ formatTime(worker?.created_at || null) }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-muted-foreground">
                    {{ t("dashboard.jsRuntime.overview.updatedAt") }}
                  </p>
                  <p>{{ formatTime(worker?.updated_at || null) }}</p>
                </div>
                <div class="space-y-1 col-span-2">
                  <p class="text-sm font-medium text-muted-foreground">
                    {{ t("dashboard.jsRuntime.overview.route") }}
                  </p>
                  <p class="text-emerald-500 font-mono">
                    {{ worker?.route || t("common.none") }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="mt-4">
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle class="text-lg">脚本描述</CardTitle>
              <Button
                size="sm"
                variant="outline"
                @click="openDescriptionEditFun"
              >
                <FileText class="w-4 h-4 mr-2" />
                编辑描述
              </Button>
            </CardHeader>
            <CardContent>
              <div
                v-if="worker?.description"
                class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                v-html="renderedDescription"
              ></div>
              <div
                v-else
                class="text-muted-foreground text-sm flex flex-col items-center justify-center py-10 bg-muted/20 border border-dashed rounded-lg"
              >
                <FileText class="h-8 w-8 mb-2 opacity-50" />
                <span>无脚本描述</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" class="m-0 h-full flex flex-col min-h-0">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
            <!-- Left: Editor -->
            <div
              class="flex flex-col min-h-0 border rounded-lg overflow-hidden bg-card"
            >
              <div class="flex-1 min-h-0 overflow-hidden">
                <Codemirror
                  v-model="content"
                  :extensions="extensions"
                  class="h-full text-[13px]"
                  :style="{ height: '100%' }"
                />
              </div>
            </div>

            <!-- Right: Controls & Result -->
            <div class="flex flex-col gap-4 min-h-0">
              <div class="p-4 border rounded-lg bg-card space-y-4">
                <div class="flex items-center gap-2">
                  <Button
                    size="sm"
                    @click="runWorkerFun('call')"
                    :disabled="runLoading"
                  >
                    <Play class="mr-2 h-3 w-3" />
                    {{ t("dashboard.jsRuntime.editor.runCall") }}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    @click="runWorkerFun('cron')"
                    :disabled="runLoading"
                  >
                    <Clock class="mr-2 h-3 w-3" />
                    {{ t("dashboard.jsRuntime.editor.runCron") }}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    @click="isPreviewMode = true"
                  >
                    <Eye class="mr-2 h-3 w-3" />
                    {{ t("dashboard.jsRuntime.editor.preview") }}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    @click="updateWorkerContentFun"
                    :disabled="saveLoading"
                  >
                    <Loader2
                      v-if="saveLoading"
                      class="mr-2 h-3 w-3 animate-spin"
                    />
                    <Save class="mr-2 h-3 w-3" v-else />
                    {{ t("dashboard.jsRuntime.editor.save") }}
                  </Button>
                </div>

                <Tabs v-model="activeEditorTab" class="w-full">
                  <TabsList class="grid w-full grid-cols-2">
                    <TabsTrigger value="params">
                      {{ t("dashboard.jsRuntime.editor.params") }}
                    </TabsTrigger>
                    <TabsTrigger value="env">
                      {{ t("dashboard.jsRuntime.editor.env") }}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="params"
                    class="mt-2 h-24 border rounded-md overflow-hidden"
                  >
                    <Codemirror
                      v-model="runParams"
                      :extensions="jsonExtensions"
                      class="h-full text-[12px]"
                      :style="{ height: '100%' }"
                    />
                  </TabsContent>
                  <TabsContent
                    value="env"
                    class="mt-2 h-24 border rounded-md overflow-hidden"
                  >
                    <Codemirror
                      v-model="runEnv"
                      :extensions="jsonExtensions"
                      class="h-full text-[12px]"
                      :style="{ height: '100%' }"
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div
                class="flex-1 min-h-0 border rounded-lg overflow-hidden flex flex-col bg-card"
              >
                <div
                  class="p-2 border-b bg-muted/30 flex items-center justify-between"
                >
                  <span class="text-sm font-medium px-2">{{
                    isPreviewMode
                      ? t("dashboard.jsRuntime.editor.preview")
                      : t("dashboard.jsRuntime.editor.result")
                  }}</span>
                  <Button
                    v-if="isPreviewMode && worker?.route"
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    @click="iframeKey++"
                    :title="t('common.refresh', '刷新')"
                  >
                    <RotateCcw class="h-3 w-3" />
                  </Button>
                </div>
                <div class="flex-1 min-h-0 overflow-hidden relative">
                  <div
                    v-if="runLoading"
                    class="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center"
                  >
                    <Loader2
                      class="h-8 w-8 animate-spin text-muted-foreground"
                    />
                  </div>

                  <template v-if="isPreviewMode">
                    <div
                      v-if="!worker?.route"
                      class="flex items-center justify-center h-full text-muted-foreground text-sm"
                    >
                      未绑定路由，请先绑定路由后操作
                    </div>
                    <iframe
                      v-else
                      :key="iframeKey"
                      :src="`/worker-route/${worker?.route}`"
                      sandbox="allow-scripts allow-same-origin"
                      class="w-full h-full border-0"
                    ></iframe>
                  </template>

                  <Codemirror
                    v-else
                    :model-value="
                      runResult ? JSON.stringify(runResult, null, 2) : ''
                    "
                    :extensions="jsonExtensions"
                    class="h-full text-[12px]"
                    :style="{ height: '100%' }"
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="logs"
          class="m-0 h-full flex flex-col min-h-0 space-y-4 pt-1"
        >
          <div
            class="bg-card border rounded-xl shadow-sm p-4 transition-all shrink-0"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.recordId", "Record ID")
                }}</label>
                <Input
                  v-model="logFilter.id"
                  type="number"
                  min="1"
                  class="bg-background/50 h-9"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.status", "Status")
                }}</label>
                <Select v-model="logFilter.status">
                  <SelectTrigger class="bg-background/50 h-9 w-full"
                    ><SelectValue
                  /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"
                      ><span class="flex items-center gap-2">{{
                        t("common.all", "All")
                      }}</span></SelectItem
                    >
                    <SelectItem value="success"
                      ><span class="flex items-center gap-2">{{
                        t("dashboard.jsRuntime.logs.success", "Success")
                      }}</span></SelectItem
                    >
                    <SelectItem value="failed"
                      ><span class="flex items-center gap-2">{{
                        t("dashboard.jsRuntime.logs.error", "Failed")
                      }}</span></SelectItem
                    >
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.limit", "Return Limit")
                }}</label>
                <Input
                  :model-value="logFilter.limit"
                  type="number"
                  min="1"
                  max="500"
                  class="bg-background/50 h-9"
                  @update:model-value="
                    logFilter.limit = Math.max(1, Number($event) || 20)
                  "
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.latestOnly", "Latest Only")
                }}</label>
                <Select
                  :model-value="logFilter.latestOnly ? 'yes' : 'no'"
                  @update:model-value="logFilter.latestOnly = $event === 'yes'"
                >
                  <SelectTrigger class="bg-background/50 h-9 w-full"
                    ><SelectValue
                  /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{{
                      t("common.disable", "Disabled")
                    }}</SelectItem>
                    <SelectItem value="yes">{{
                      t("common.enable", "Enabled")
                    }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                class="sm:col-span-2 lg:col-span-4 flex items-end justify-end gap-3 w-full"
              >
                <Button
                  :disabled="logsLoading"
                  @click="resetLogsFilterFun"
                  variant="outline"
                  class="h-9 px-4 hover:bg-muted"
                >
                  <RotateCcw
                    class="mr-2 h-4 w-4"
                    :class="{ 'animate-spin': logsLoading }"
                  />
                  {{ t("common.reset", "Reset") }}
                </Button>
                <Button
                  :disabled="logsLoading"
                  @click="loadLogsFun"
                  class="h-9 px-6 hover:shadow-md"
                >
                  <Search class="mr-2 h-4 w-4" v-if="!logsLoading" />
                  <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
                  {{ t("common.search", "Search") }}
                </Button>
              </div>
            </div>
          </div>

          <div
            class="flex-1 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col min-h-0 overflow-hidden relative"
          >
            <div class="flex-1 min-h-0 overflow-auto">
              <Table>
                <TableHeader class="bg-muted/30">
                  <TableRow class="hover:bg-transparent">
                    <TableHead
                      class="w-[100px] font-medium whitespace-nowrap"
                      >{{
                        t("dashboard.jsRuntime.logs.recordId", "Record ID")
                      }}</TableHead
                    >
                    <TableHead
                      class="w-[170px] font-medium whitespace-nowrap"
                      >{{
                        t(
                          "dashboard.jsRuntime.logs.startTime",
                          "Execution Time",
                        )
                      }}</TableHead
                    >
                    <TableHead
                      class="w-[100px] font-medium whitespace-nowrap"
                      >{{
                        t("dashboard.jsRuntime.logs.status", "Status")
                      }}</TableHead
                    >
                    <TableHead class="font-medium whitespace-nowrap">{{
                      t("dashboard.jsRuntime.logs.message", "Message")
                    }}</TableHead>
                    <TableHead class="w-[150px] font-medium text-right pr-6">{{
                      t("dashboard.jsRuntime.logs.actions", "Actions")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="logsLoading && logs.length === 0">
                    <TableCell colspan="5" class="h-[300px] text-center">
                      <div
                        class="flex flex-col items-center justify-center space-y-3"
                      >
                        <Loader2
                          class="w-6 h-6 animate-spin text-muted-foreground/50"
                        />
                        <span class="text-sm font-medium">{{
                          t("common.loading")
                        }}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow v-else-if="logs.length === 0">
                    <TableCell colspan="5" class="h-[300px] text-center">
                      <div
                        class="flex flex-col items-center justify-center text-muted-foreground space-y-3"
                      >
                        <div
                          class="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center"
                        >
                          <Inbox class="w-6 h-6 text-muted-foreground/60" />
                        </div>
                        <p class="text-sm">
                          {{ t("common.noData", "No Data") }}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow v-for="log in logs" :key="log.id">
                    <TableCell
                      class="font-mono text-xs text-foreground/80 py-3"
                      >{{ log.id }}</TableCell
                    >
                    <TableCell class="whitespace-nowrap py-3">
                      <div
                        class="flex items-center gap-2 text-sm text-foreground/90"
                      >
                        <span class="font-mono">{{
                          formatTime(log.start_time)
                        }}</span>
                      </div>
                    </TableCell>
                    <TableCell class="py-3">
                      <Badge
                        :variant="log.error_message ? 'destructive' : 'default'"
                      >
                        {{
                          log.error_message
                            ? t("dashboard.jsRuntime.logs.error", "Error")
                            : t("dashboard.jsRuntime.logs.success", "Success")
                        }}
                      </Badge>
                    </TableCell>
                    <TableCell class="py-3">
                      <p
                        class="text-sm truncate max-w-[200px] md:max-w-[400px] text-foreground/80"
                        :title="
                          log.error_message ||
                          t('dashboard.jsRuntime.logs.success', 'Success')
                        "
                      >
                        {{
                          log.error_message ||
                          t("dashboard.jsRuntime.logs.success", "Success")
                        }}
                      </p>
                    </TableCell>
                    <TableCell class="text-right pr-6 py-3">
                      <div class="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="
                            currentLog = log;
                            logDetailOpen = true;
                          "
                          :title="t('dashboard.jsRuntime.logs.view', 'View')"
                        >
                          <FileText class="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="text-destructive hover:text-destructive"
                          @click="deleteLogFun(log.id)"
                          :title="t('common.delete', 'Delete')"
                        >
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div
              v-if="totalPages > 1 || allLogs.length > 0"
              class="border-t bg-muted/10 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div
                class="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div class="flex items-center gap-2">
                  <span>{{
                    t("dashboard.jsRuntime.logs.limit", "Return Limit")
                  }}</span>
                  <Select
                    :model-value="String(pageSize)"
                    @update:model-value="
                      (v) => {
                        pageSize = Number(v);
                        currentPage = 1;
                      }
                    "
                  >
                    <SelectTrigger class="h-8 w-[88px] bg-background"
                      ><SelectValue
                    /></SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in pageSizeOptions"
                        :key="option"
                        :value="String(option)"
                        >{{ option }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>
                <span
                  >{{ totalPages > 0 ? currentPage : 0 }} /
                  {{ totalPages }}</span
                >
              </div>
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 px-3 shadow-sm bg-background transition-colors hover:bg-muted"
                  :disabled="currentPage <= 1 || logsLoading"
                  @click="currentPage--"
                >
                  <ChevronLeft class="w-4 h-4 mr-1" />
                  {{ t("common.previous") }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 px-3 shadow-sm bg-background transition-colors hover:bg-muted"
                  :disabled="currentPage >= totalPages || logsLoading"
                  @click="currentPage++"
                >
                  {{ t("common.next") }}
                  <ChevronRight class="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" class="m-0">
          <div class="max-w-3xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{{
                  t("dashboard.jsRuntime.settings.envVars")
                }}</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div
                  v-for="(item, index) in envVars"
                  :key="index"
                  class="flex gap-4 items-center"
                >
                  <Input
                    v-model="item.key"
                    :placeholder="t('dashboard.jsRuntime.settings.key')"
                    class="flex-1"
                  />
                  <Input
                    v-model="item.value"
                    :placeholder="t('dashboard.jsRuntime.settings.value')"
                    class="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 text-destructive"
                    @click="envVars.splice(index, 1)"
                    v-if="index < envVars.length - 1"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                  <div class="w-8" v-else></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{{
                  t("dashboard.jsRuntime.settings.route")
                }}</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="flex gap-4 items-center">
                  <Input
                    v-model="workerRoute"
                    :placeholder="t('dashboard.jsRuntime.settings.route')"
                    class="flex-1 font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{{
                  t("dashboard.jsRuntime.settings.cleanTime")
                }}</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="flex gap-4 items-center">
                  <Input
                    v-model="cleanTime"
                    :placeholder="t('dashboard.jsRuntime.settings.cleanTime')"
                    class="flex-1 font-mono"
                    type="number"
                  />
                </div>
              </CardContent>
            </Card>

            <div class="flex justify-end">
              <Button @click="updateWorkerSettingsFun" :disabled="saveLoading">
                <Loader2 v-if="saveLoading" class="mr-2 h-4 w-4 animate-spin" />
                {{ t("dashboard.jsRuntime.settings.confirm") }}
              </Button>
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>

    <Dialog v-model:open="logDetailOpen">
      <DialogContent class="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{{
            t("dashboard.jsRuntime.logs.detailTitle", "Log Detail")
          }}</DialogTitle>
          <DialogDescription> ID: {{ currentLog?.id }} </DialogDescription>
        </DialogHeader>
        <div class="flex-1 p-4 border rounded-md min-h-0 overflow-auto">
          <div class="space-y-4">
            <div>
              <h4 class="font-medium mb-2">Params</h4>
              <div class="h-48">
                <Codemirror
                  :model-value="
                    currentLog?.param
                      ? JSON.stringify(currentLog.param, null, 2)
                      : '{}'
                  "
                  :extensions="jsonExtensions"
                  class="text-[12px] border rounded h-full"
                  :style="{ height: '100%' }"
                  disabled
                />
              </div>
            </div>
            <div>
              <h4 class="font-medium mb-2">Result</h4>
              <div class="h-48">
                <Codemirror
                  :model-value="
                    currentLog?.result
                      ? JSON.stringify(currentLog.result, null, 2)
                      : 'null'
                  "
                  :extensions="jsonExtensions"
                  class="text-[12px] border rounded h-full"
                  :style="{ height: '100%' }"
                  disabled
                />
              </div>
            </div>
            <div v-if="currentLog?.error_message">
              <h4 class="font-medium mb-2 text-destructive">Error</h4>
              <pre
                class="p-2 border border-destructive/20 bg-destructive/10 text-destructive rounded overflow-auto text-sm"
                >{{ currentLog.error_message }}</pre
              >
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>

  <Dialog v-model:open="descriptionEditOpen">
    <DialogContent class="sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle>编辑脚本描述</DialogTitle>
        <DialogDescription
          >支持 Markdown 语法，不支持 HTML
          标签嵌入，留空则显示无描述。</DialogDescription
        >
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="flex flex-col min-h-0 border rounded-lg bg-card">
          <Codemirror
            v-model="descriptionEditText"
            :extensions="[]"
            class="h-[400px] text-[13px]"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t mt-2">
        <Button variant="outline" @click="descriptionEditOpen = false"
          >取消</Button
        >
        <Button
          @click="updateWorkerDescriptionFun"
          :disabled="descriptionLoading"
        >
          <Loader2
            v-if="descriptionLoading"
            class="mr-2 h-4 w-4 animate-spin"
          />
          保存描述
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
