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

// Settings Tab State
const envVars = ref<{ key: string; value: string }[]>([]);
const workerRoute = ref("");
const cleanTime = ref("");

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

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

const logFilter = ref({
  id: "",
  startTime: formatDateTimeLocal(oneHourAgo),
  endTime: formatDateTimeLocal(now),
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

    if (
      !logFilter.value.latestOnly &&
      logFilter.value.startTime &&
      logFilter.value.endTime
    ) {
      const startTs = new Date(logFilter.value.startTime).getTime();
      const endTs = new Date(logFilter.value.endTime).getTime();
      condition.push({ start_time_from_to: [startTs, endTs] });
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
  const n = new Date();
  const o = new Date(n.getTime() - 60 * 60 * 1000);
  logFilter.value = {
    id: "",
    startTime: formatDateTimeLocal(o),
    endTime: formatDateTimeLocal(n),
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
      cleanTime.value = data.runtime_clean_time || "";
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

const updateWorkerContentFun = async () => {
  if (!worker.value) return;
  saveLoading.value = true;
  try {
    await runtime.updateWorker(worker.value.name, { content: content.value });
    toast.success(t("dashboard.jsRuntime.updateSuccess"));
    worker.value.content = content.value;
  } catch (e: any) {
    toast.error(e.message || "Save failed");
  } finally {
    saveLoading.value = false;
  }
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
      toast.error("Invalid Params JSON");
      return;
    }
    try {
      envObj = JSON.parse(runEnv.value);
    } catch {
      toast.error("Invalid Env JSON");
      return;
    }

    const result = await runtime.runWorker(
      worker.value.name,
      runType,
      paramsObj,
      envObj,
    );
    runResult.value = result;
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
    await runtime.updateWorker(worker.value.name, {
      route: workerRoute.value,
      runtime_clean_time: cleanTime.value,
      env: envObj,
    });
    toast.success(t("dashboard.jsRuntime.updateSuccess"));
    await getWorkerFun();
  } catch (e: any) {
    toast.error(e.message || "Update failed");
  } finally {
    saveLoading.value = false;
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
                <div class="p-2 border-b bg-muted/30">
                  <span class="text-sm font-medium px-2">{{
                    isPreviewMode
                      ? t("dashboard.jsRuntime.editor.preview")
                      : t("dashboard.jsRuntime.editor.result")
                  }}</span>
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
                      该 Worker 暂未绑定路由，无法预览
                    </div>
                    <iframe
                      v-else
                      :src="`/${worker?.route}`"
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
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.startTime", "Start Time")
                }}</label>
                <Input
                  v-model="logFilter.startTime"
                  type="datetime-local"
                  class="bg-background/50 h-9"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground/80">{{
                  t("dashboard.jsRuntime.logs.endTime", "End Time")
                }}</label>
                <Input
                  v-model="logFilter.endTime"
                  type="datetime-local"
                  class="bg-background/50 h-9"
                />
              </div>
              <div
                class="sm:col-span-2 flex items-end justify-end gap-3 w-full"
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

          <Card class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div class="flex-1 min-h-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[100px]">{{
                      t("dashboard.jsRuntime.logs.recordId", "Record ID")
                    }}</TableHead>
                    <TableHead class="w-[170px]">{{
                      t("dashboard.jsRuntime.logs.startTime", "Execution Time")
                    }}</TableHead>
                    <TableHead class="w-[100px]">{{
                      t("dashboard.jsRuntime.logs.status", "Status")
                    }}</TableHead>
                    <TableHead>{{
                      t("dashboard.jsRuntime.logs.message", "Message")
                    }}</TableHead>
                    <TableHead class="text-right w-[150px]">{{
                      t("dashboard.jsRuntime.logs.actions", "Actions")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="logs.length === 0">
                    <TableCell
                      colspan="5"
                      class="text-center py-8 text-muted-foreground"
                    >
                      {{
                        logsLoading ? t("common.loading") : t("common.noData")
                      }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-for="log in logs" :key="log.id">
                    <TableCell class="font-mono text-xs">{{
                      log.id
                    }}</TableCell>
                    <TableCell class="whitespace-nowrap">{{
                      formatTime(log.start_time)
                    }}</TableCell>
                    <TableCell>
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
                    <TableCell>
                      <p
                        class="text-sm truncate max-w-[200px] md:max-w-[400px]"
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
                    <TableCell class="text-right">
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
          </Card>
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
</template>
