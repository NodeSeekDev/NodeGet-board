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
  Globe,
  Plus,
  ChevronDown,
  ExternalLink,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
const saveOnlyLoading = ref(false);
const saveAndRunLoading = ref(false);
const isPreviewMode = ref(false);
const activeEditorTab = ref("env");
const iframeKey = ref(0);
const settingsLoading = ref(false);
const isActionPending = computed(
  () =>
    saveOnlyLoading.value ||
    saveAndRunLoading.value ||
    runLoading.value ||
    settingsLoading.value ||
    loading.value,
);

const parsedHttpResult = computed(() => {
  if (
    !runResult.value ||
    activeRunMode.value !== "http" ||
    !runResult.value.result
  )
    return null;
  let res = runResult.value.result;

  // Unwrap nested backend response if needed
  if (Array.isArray(res) && res.length > 0) res = res[0];
  if (res && res.result) res = res.result;

  if (typeof res !== "object" || Array.isArray(res)) return null;

  // 1. Get Status and Headers
  const status = res.status || null;
  let headersText = "";
  let contentType = "text/plain";

  if (res.headers) {
    const list = Array.isArray(res.headers)
      ? res.headers
      : Object.entries(res.headers).map(([k, v]) => ({ name: k, value: v }));

    headersText = list.map((h: any) => `${h.name}: ${h.value}`).join("\n");

    const ctHeader = list.find(
      (h: any) => h.name?.toLowerCase() === "content-type",
    )?.value;
    if (ctHeader) contentType = String(ctHeader).toLowerCase();
  }

  // 2. Identify data source (prioritize binary)
  let rawBody =
    res.body_bytes !== undefined
      ? res.body_bytes
      : res.body !== undefined
        ? res.body
        : res.data;

  // 3. Process Body based on content type
  const isImage = contentType.includes("image/");
  const isHtml = contentType.includes("text/html");
  const isJson = contentType.includes("application/json");

  let body: any = null;

  if (rawBody === undefined) {
    body = { isText: true, content: "" };
  } else if (Array.isArray(rawBody) || rawBody instanceof Uint8Array) {
    const uint8Body =
      rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody);

    if (isImage) {
      try {
        const blob = new Blob([uint8Body as any], {
          type: contentType.split(";")[0],
        });
        body = { isImage: true, url: URL.createObjectURL(blob) };
      } catch {
        body = { isText: true, content: "[Image Decode Error]" };
      }
    } else {
      try {
        const decodedText = new TextDecoder().decode(uint8Body);
        if (isHtml) {
          body = { isHtml: true, content: decodedText };
        } else if (isJson) {
          try {
            body = {
              isText: true,
              content: JSON.stringify(JSON.parse(decodedText), null, 2),
            };
          } catch {
            body = { isText: true, content: decodedText };
          }
        } else {
          body = { isText: true, content: decodedText };
        }
      } catch (e) {
        body = {
          isText: true,
          content: `[Binary Data ${uint8Body.length} bytes]`,
        };
      }
    }
  } else {
    const content =
      typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody, null, 2);
    if (isHtml) {
      body = { isHtml: true, content };
    } else {
      body = { isText: true, content };
    }
  }

  return {
    status,
    headersText,
    body,
  };
});

const activeRunMode = ref<"call" | "cron" | "http" | "preview">("call");
const httpSimulation = ref({
  method: "POST",
  suffix: "",
  headers: [{ key: "Accept", value: "*/*" }],
  body: "",
});
const httpResultOpen = ref(true);
const httpHeadersOpen = ref(true);
const activeHttpTab = ref("headers");

const tempEnvVars = ref<{ key: string; value: string }[]>([]);
const isConfigOpen = ref(true);
const isEnvDirty = computed(() => {
  if (!worker.value) return false;
  const currentEnv = worker.value.env || {};
  const activeTemp = tempEnvVars.value.filter((e) => e.key.trim() !== "");

  if (Object.keys(currentEnv).length !== activeTemp.length) return true;

  for (const item of activeTemp) {
    if (currentEnv[item.key] !== item.value) return true;
  }
  return false;
});

const ensureEmptyTempEnvRow = () => {
  if (
    tempEnvVars.value.length === 0 ||
    tempEnvVars.value[tempEnvVars.value.length - 1]!.key !== "" ||
    tempEnvVars.value[tempEnvVars.value.length - 1]!.value !== ""
  ) {
    tempEnvVars.value.push({ key: "", value: "" });
  }
};

watch(
  tempEnvVars,
  () => {
    ensureEmptyTempEnvRow();
  },
  { deep: true },
);

const wsHost = computed(() => {
  try {
    const url = new URL(runtime.backendUrl.value);
    return url.host;
  } catch {
    return "WS_HOST";
  }
});

const httpBaseUrl = computed(() => {
  let url = runtime.backendUrl.value || "";
  url = url.replace(/^ws/, "http");
  if (url.endsWith("/ws")) url = url.slice(0, -3);
  if (url.endsWith("/ws/")) url = url.slice(0, -4);
  return url;
});

const wsBaseUrl = computed(() => {
  let url = runtime.backendUrl.value || "";
  if (url.endsWith("/ws")) url = url.slice(0, -3);
  if (url.endsWith("/ws/")) url = url.slice(0, -4);
  return url;
});

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
      tempEnvVars.value = Object.entries(data.env || {}).map(
        ([key, value]) => ({
          key,
          value: String(value),
        }),
      );
      // Always keep one empty row for new env var
      ensureEmptyEnvRow();
      ensureEmptyTempEnvRow();
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

const updateWorkerContentFun = async (
  withEnv = false,
  loadingRef = saveOnlyLoading,
) => {
  if (!worker.value) return;
  loadingRef.value = true;
  try {
    const latest = await syncLatestWorkerState();
    let envObj: Record<string, any> = latest.env || {};
    if (withEnv) {
      envObj = {};
      tempEnvVars.value.forEach((item) => {
        if (item.key.trim()) {
          envObj[item.key.trim()] = item.value;
        }
      });
      runEnv.value = JSON.stringify(envObj, null, 2);
    }

    await runtime.updateWorker(latest.name, {
      content: content.value,
      route: latest.route || undefined,
      runtime_clean_time: latest.runtime_clean_time,
      env: envObj,
      description: latest.description || "",
    });
    toast.success(t("dashboard.jsRuntime.updateSuccess"));
    worker.value.content = content.value;
    if (withEnv) {
      worker.value.env = envObj;
      envVars.value = Object.entries(envObj).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      tempEnvVars.value = Object.entries(envObj).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      ensureEmptyEnvRow();
      ensureEmptyTempEnvRow();
    }
  } catch (e: any) {
    toast.error(e.message || "Save failed");
  } finally {
    loadingRef.value = false;
  }
};

const handleJsonParseError = (errorMessage: string): boolean => {
  toast.error(errorMessage);
  runLoading.value = false;
  return false;
};

const runWorkerFun = async (saveFirst = false) => {
  if (!worker.value) return;

  if (saveFirst) {
    saveAndRunLoading.value = true;
    try {
      await updateWorkerContentFun(
        activeRunMode.value === "call" || activeRunMode.value === "cron",
        saveAndRunLoading,
      );
    } catch {
      saveAndRunLoading.value = false;
      return;
    }
  } else if (activeRunMode.value === "call" || activeRunMode.value === "cron") {
    // If not saving first, we still want to use the temp env for execution
    const envObj: Record<string, string> = {};
    tempEnvVars.value.forEach((item) => {
      if (item.key.trim()) {
        envObj[item.key.trim()] = item.value;
      }
    });
    runEnv.value = JSON.stringify(envObj);
  }

  if (activeRunMode.value === "preview") {
    iframeKey.value++;
    return;
  }

  runLoading.value = true;
  runResult.value = null;
  try {
    let paramsObj = {};
    let envObj = {};

    // Determine which mode we're in
    const mode = activeRunMode.value;

    if (mode === "call" || mode === "cron") {
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
        mode,
        paramsObj,
        {
          env: envObj,
          compile_mode: "source",
        },
      );
      runResult.value = result;
      await pollResult(result);
    } else if (mode === "http") {
      // HTTP simulation
      const headers = httpSimulation.value.headers
        .filter((h) => h.key.trim())
        .map((h) => ({ name: h.key.trim(), value: h.value }));

      let body_bytes: number[] = [];
      if (httpSimulation.value.body) {
        body_bytes = Array.from(
          new TextEncoder().encode(httpSimulation.value.body),
        );
      }

      const suffix = httpSimulation.value.suffix
        ? httpSimulation.value.suffix.startsWith("/")
          ? httpSimulation.value.suffix
          : "/" + httpSimulation.value.suffix
        : "";
      const simulatedUrl = `https://mock.local/worker-route/${worker.value.route || ""}${suffix}`;

      const routeParams = {
        url: simulatedUrl,
        method: httpSimulation.value.method,
        headers,
        body_bytes: body_bytes,
      };

      const result = await runtime.runWorker(
        worker.value.name,
        "route",
        routeParams, // Passed perfectly as JSON Request simulator
        {
          compile_mode: "source", // Always source as per requirement for testing
        },
      );
      runResult.value = result;
      await pollResult(result);
    }
  } catch (e: any) {
    runResult.value = { error: e.message || "Run failed" };
  } finally {
    runLoading.value = false;
  }
};

const pollResult = async (result: any) => {
  if (result && result.id) {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const logs = await runtime.getWorkerLogs([{ id: Number(result.id) }]);
      if (logs && logs.length > 0) {
        const log = logs[0];
        if (log) {
          runResult.value = log;
          if (log.finish_time) break;
        }
      }
    }
  }
};

const addHttpHeaderFun = () => {
  httpSimulation.value.headers.push({ key: "", value: "" });
};

const removeHttpHeaderFun = (index: number) => {
  httpSimulation.value.headers.splice(index, 1);
};

watch(activeRunMode, (newMode) => {
  if ((newMode === "call" || newMode === "cron") && worker.value?.env) {
    const envObj = worker.value.env;
    runEnv.value = JSON.stringify(envObj, null, 2);
    tempEnvVars.value = Object.entries(envObj).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    ensureEmptyTempEnvRow();
  }
});

const openPreviewNewWindowFun = () => {
  if (!worker.value?.route) return;
  const suffix = httpSimulation.value.suffix;
  const path = `${httpBaseUrl.value}/worker-route/${worker.value.route}/${suffix}`;
  window.open(path, "_blank");
};

const updateWorkerSettingsFun = async () => {
  if (!worker.value) return;
  const envObj: Record<string, string> = {};
  envVars.value.forEach((item) => {
    if (item.key.trim()) {
      envObj[item.key.trim()] = item.value;
    }
  });

  settingsLoading.value = true;
  try {
    const latest = await syncLatestWorkerState();

    await runtime.updateWorker(latest.name, {
      route: workerRoute.value || undefined,
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
    settingsLoading.value = false;
  }
};

const updateWorkerDescriptionFun = async () => {
  if (!worker.value) return;
  descriptionLoading.value = true;
  try {
    const latest = await syncLatestWorkerState();

    await runtime.updateWorker(latest.name, {
      content: latest.content,
      route: latest.route || undefined,
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
          <div class="px-1 py-1">
            <div
              class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground/60 font-mono"
            >
              <div class="flex items-center gap-1.5">
                <span class="shrink-0"
                  >{{ t("dashboard.jsRuntime.overview.createdAt") }}:</span
                >
                <span class="">{{
                  formatTime(worker?.created_at || null)
                }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="shrink-0"
                  >{{ t("dashboard.jsRuntime.overview.updatedAt") }}:</span
                >
                <span class="">{{
                  formatTime(worker?.updated_at || null)
                }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="shrink-0"
                  >{{ t("dashboard.jsRuntime.overview.route") }}:</span
                >
                <span class="break-all">{{
                  worker?.route || t("common.none")
                }}</span>
              </div>
            </div>
          </div>

          <Card class="mt-4 gap-0">
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle
                class="text-[13px] font-medium text-muted-foreground/50 uppercase tracking-wider"
                >README</CardTitle
              >
              <Button
                size="sm"
                variant="outline"
                @click="openDescriptionEditFun"
              >
                <FileText class="w-4 h-4 mr-2" />
                编辑描述
              </Button>
            </CardHeader>
            <CardContent class="pt-2 pb-4">
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

        <TabsContent
          value="content"
          class="m-0 h-full flex flex-col min-h-0 relative"
        >
          <div
            v-if="activeTab === 'content' && isActionPending"
            class="absolute inset-0 z-[100] cursor-wait bg-background/5"
          ></div>

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
            <div class="flex flex-col gap-4 min-h-0 relative">
              <!-- Mode Tabs & Top Actions -->
              <div class="flex items-center justify-between gap-4">
                <Tabs v-model="activeRunMode" class="w-fit">
                  <TabsList>
                    <TabsTrigger value="call">
                      {{ t("dashboard.jsRuntime.editor.runCall") }}
                    </TabsTrigger>
                    <TabsTrigger value="cron">
                      {{ t("dashboard.jsRuntime.editor.runCron") }}
                    </TabsTrigger>
                    <TabsTrigger value="http">
                      {{ t("dashboard.jsRuntime.editor.http") }}
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      {{ t("dashboard.jsRuntime.editor.preview") }}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div class="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    class="h-8 shadow-sm"
                    @click="updateWorkerContentFun(true)"
                    :disabled="isActionPending"
                  >
                    <Loader2
                      v-if="saveOnlyLoading"
                      class="mr-2 h-3 w-3 animate-spin"
                    />
                    <Save v-else class="mr-2 h-3 w-3" />
                    {{ t("dashboard.jsRuntime.editor.save") }}
                  </Button>
                </div>
              </div>

              <!-- Content Area based on activeRunMode -->
              <div
                class="flex-1 flex flex-col gap-4 min-h-0 overflow-auto pr-1"
              >
                <!-- Call / Cron Mode UI -->
                <template
                  v-if="activeRunMode === 'call' || activeRunMode === 'cron'"
                >
                  <Collapsible v-model:open="isConfigOpen">
                    <Tabs v-model="activeEditorTab" class="space-y-4">
                      <div class="flex items-center justify-between group">
                        <div class="flex-1">
                          <TabsList class="grid w-full grid-cols-2">
                            <TabsTrigger value="env" class="relative">
                              {{ t("dashboard.jsRuntime.editor.env") }}
                              <span
                                v-if="isEnvDirty"
                                class="absolute -top-1 -right-1 text-orange-500 font-bold"
                                >*</span
                              >
                            </TabsTrigger>
                            <TabsTrigger value="params">
                              {{ t("dashboard.jsRuntime.editor.params") }}
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        <CollapsibleTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-8 w-8 ml-2 shrink-0"
                          >
                            <ChevronDown
                              class="h-4 w-4 transition-transform duration-200"
                              :class="{ 'rotate-180': isConfigOpen }"
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent class="space-y-4">
                        <TabsContent
                          value="params"
                          class="m-0 h-32 border rounded-md overflow-hidden bg-card"
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
                          class="m-0 min-h-32 border rounded-md overflow-hidden bg-card flex flex-col"
                        >
                          <div class="flex-1 overflow-auto p-2">
                            <Table>
                              <TableHeader>
                                <TableRow class="hover:bg-transparent">
                                  <TableHead class="h-8 text-xs">{{
                                    t("dashboard.jsRuntime.settings.key")
                                  }}</TableHead>
                                  <TableHead class="h-8 text-xs">{{
                                    t("dashboard.jsRuntime.settings.value")
                                  }}</TableHead>
                                  <TableHead class="h-8 w-[40px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow
                                  v-for="(item, index) in tempEnvVars"
                                  :key="index"
                                  class="hover:bg-transparent border-none"
                                >
                                  <TableCell class="p-1 h-auto">
                                    <Input
                                      v-model="item.key"
                                      class="h-7 text-xs font-mono"
                                      placeholder="Key"
                                    />
                                  </TableCell>
                                  <TableCell class="p-1 h-auto">
                                    <Input
                                      v-model="item.value"
                                      class="h-7 text-xs font-mono"
                                      placeholder="Value"
                                    />
                                  </TableCell>
                                  <TableCell class="p-1 h-auto text-center">
                                    <Button
                                      v-if="index !== tempEnvVars.length - 1"
                                      variant="ghost"
                                      size="icon"
                                      class="h-7 w-7 text-destructive"
                                      @click="tempEnvVars.splice(index, 1)"
                                    >
                                      <Trash2 class="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      </CollapsibleContent>
                    </Tabs>
                  </Collapsible>
                </template>

                <!-- Http Mode UI -->
                <template v-else-if="activeRunMode === 'http'">
                  <div class="space-y-2">
                    <!-- URL Display -->
                    <div
                      class="p-2 bg-muted/40 rounded-lg flex items-center gap-2 text-[13px] font-mono overflow-hidden"
                    >
                      <Select v-model="httpSimulation.method">
                        <SelectTrigger
                          class="h-6 w-auto px-1.5 py-0 gap-0.5 [&>svg]:ml-0 [&>svg]:h-3 [&>svg]:w-3 text-[10px] font-mono shrink-0 bg-background border-muted"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET" class="text-[10px]"
                            >GET</SelectItem
                          >
                          <SelectItem value="POST" class="text-[10px]"
                            >POST</SelectItem
                          >
                          <SelectItem value="PUT" class="text-[10px]"
                            >PUT</SelectItem
                          >
                          <SelectItem value="DELETE" class="text-[10px]"
                            >DELETE</SelectItem
                          >
                        </SelectContent>
                      </Select>
                      <div
                        class="flex-1 flex min-w-0 overflow-hidden text-muted-foreground mx-1"
                      >
                        <span class="truncate opacity-70 shrink min-w-[40px]">{{
                          httpBaseUrl
                        }}</span>
                        <span class="shrink-0"
                          >/worker-route/{{ worker?.route || "{ROUTE}" }}/</span
                        >
                      </div>
                      <Input
                        v-model="httpSimulation.suffix"
                        placeholder="path suffix"
                        class="h-7 px-2 font-mono text-[12px] w-[130px] shrink-0"
                      />
                    </div>
                    <p
                      v-if="!worker?.route"
                      class="text-xs text-orange-500 px-1"
                    >
                      {{ t("dashboard.jsRuntime.editor.noRoute") }}
                    </p>

                    <div
                      class="w-full space-y-3 border rounded-md p-3 bg-card shadow-sm mt-0"
                    >
                      <!-- Headers Section -->
                      <div class="space-y-2">
                        <div class="flex items-center gap-4">
                          <span class="text-[13px] font-semibold">{{
                            t("dashboard.jsRuntime.editor.header")
                          }}</span>
                          <Button
                            variant="link"
                            size="sm"
                            class="h-6 text-xs text-primary p-0"
                            @click="addHttpHeaderFun"
                          >
                            <Plus class="h-3 w-3 mr-1" />
                            {{ t("dashboard.jsRuntime.editor.addHeader") }}
                          </Button>
                        </div>
                        <div
                          v-for="(h, i) in httpSimulation.headers"
                          :key="i"
                          class="flex items-center gap-2"
                        >
                          <Input
                            v-model="h.key"
                            placeholder="Header"
                            class="h-7 text-xs"
                          />
                          <Input
                            v-model="h.value"
                            placeholder="Value"
                            class="h-7 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            @click="removeHttpHeaderFun(i)"
                          >
                            <Trash2 class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <!-- Body Section -->
                      <div class="space-y-2 pt-2">
                        <div class="text-[13px] font-semibold">
                          {{ t("dashboard.jsRuntime.editor.body") }}
                        </div>
                        <div
                          class="h-32 border rounded-md overflow-hidden bg-background"
                        >
                          <Codemirror
                            v-model="httpSimulation.body"
                            :extensions="jsonExtensions"
                            class="h-full text-[12px]"
                            :style="{ height: '100%' }"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Preview Mode UI -->
                <template v-else-if="activeRunMode === 'preview'">
                  <div class="space-y-4 flex flex-col h-full min-h-0">
                    <div
                      class="p-3 bg-muted/40 rounded-lg flex items-center gap-2 text-[13px] font-mono overflow-auto"
                    >
                      <Globe
                        class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                      <div
                        class="flex-1 flex min-w-0 overflow-hidden text-muted-foreground mx-1"
                      >
                        <span class="truncate opacity-70 shrink min-w-[40px]">{{
                          wsBaseUrl
                        }}</span>
                        <span class="shrink-0"
                          >/worker-route/{{ worker?.route || "{ROUTE}" }}/</span
                        >
                      </div>
                      <Input
                        v-model="httpSimulation.suffix"
                        placeholder="path suffix"
                        class="h-7 px-2 font-mono text-[12px] w-[130px] shrink-0"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-7 w-7 shrink-0 ml-auto"
                        @click="openPreviewNewWindowFun"
                        title="在新窗口打开"
                      >
                        <ExternalLink class="h-4 w-4" />
                      </Button>
                    </div>

                    <div class="flex items-center justify-between px-1 mt-2">
                      <h3 class="text-sm font-semibold">预览 (Preview)</h3>
                      <div class="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          @click="runWorkerFun(false)"
                          :disabled="isActionPending"
                        >
                          <Loader2
                            v-if="runLoading"
                            class="mr-2 h-3 w-3 animate-spin"
                          />
                          <Eye v-else class="mr-2 h-3 w-3" />
                          {{ t("dashboard.jsRuntime.editor.preview") }}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          @click="runWorkerFun(true)"
                          :disabled="isActionPending"
                        >
                          <Loader2
                            v-if="saveAndRunLoading"
                            class="mr-2 h-3 w-3 animate-spin"
                          />
                          <Save v-else class="mr-2 h-3 w-3" />
                          {{ t("dashboard.jsRuntime.editor.saveAndPreview") }}
                        </Button>
                      </div>
                    </div>

                    <div
                      class="flex-1 border rounded-lg bg-white min-h-[300px] relative overflow-hidden"
                    >
                      <div
                        v-if="!worker?.route"
                        class="flex items-center justify-center h-full text-muted-foreground text-sm"
                      >
                        {{ t("dashboard.jsRuntime.editor.noRoute") }}
                      </div>
                      <iframe
                        v-else-if="iframeKey > 0"
                        :key="iframeKey"
                        :src="`${httpBaseUrl}/worker-route/${worker?.route}/${httpSimulation.suffix}`"
                        sandbox="allow-scripts allow-same-origin"
                        class="w-full h-full border-0"
                      ></iframe>
                    </div>
                  </div>
                </template>

                <!-- Common Result Area (for all modes except preview which has iframe) -->
                <div
                  v-if="activeRunMode !== 'preview'"
                  class="flex flex-col gap-2 shrink-0"
                >
                  <div class="flex items-center justify-between px-1">
                    <h3 class="text-sm font-semibold">
                      {{ t("dashboard.jsRuntime.editor.result") }}
                    </h3>
                    <div class="flex items-center gap-2 scale-90 origin-right">
                      <Button
                        v-if="activeRunMode === 'http' && runResult"
                        variant="ghost"
                        size="sm"
                        class="h-8 px-3 text-xs border"
                        @click="httpResultOpen = !httpResultOpen"
                      >
                        {{ !httpResultOpen ? "展开结果" : "折叠结果" }}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        @click="runWorkerFun(false)"
                        :disabled="isActionPending"
                      >
                        <Loader2
                          v-if="runLoading"
                          class="mr-2 h-3 w-3 animate-spin"
                        />
                        <Play v-else class="mr-2 h-3 w-3" />
                        {{ t("dashboard.jsRuntime.editor.run") }}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        @click="runWorkerFun(true)"
                        :disabled="isActionPending"
                      >
                        <Loader2
                          v-if="saveAndRunLoading"
                          class="mr-2 h-3 w-3 animate-spin"
                        />
                        <Save v-else class="mr-2 h-3 w-3" />
                        {{ t("dashboard.jsRuntime.editor.saveAndRun") }}
                      </Button>
                    </div>
                  </div>

                  <div
                    class="border rounded-lg bg-card overflow-hidden relative"
                  >
                    <div
                      v-if="runLoading"
                      class="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center"
                    >
                      <Loader2
                        class="h-6 w-6 animate-spin text-muted-foreground"
                      />
                    </div>

                    <Collapsible v-model:open="httpResultOpen">
                      <CollapsibleContent
                        force-mount
                        class="data-[state=closed]:h-0 overflow-hidden transition-all"
                      >
                        <template v-if="parsedHttpResult">
                          <!-- Part 1: Status Code -->
                          <div
                            class="flex items-center gap-2 px-3 py-2 border-b bg-muted/5"
                          >
                            <div
                              :class="[
                                'w-2 h-2 rounded-full',
                                parsedHttpResult.status >= 200 &&
                                parsedHttpResult.status < 300
                                  ? 'bg-green-500'
                                  : 'bg-orange-500',
                              ]"
                            ></div>
                            <span class="text-sm font-mono font-bold">{{
                              parsedHttpResult.status
                            }}</span>
                          </div>

                          <!-- Part 2: Response Headers (Collapsible) -->
                          <div class="border-b">
                            <button
                              @click="httpHeadersOpen = !httpHeadersOpen"
                              class="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted/30 transition-colors uppercase tracking-tight"
                            >
                              <span>{{
                                t("dashboard.jsRuntime.editor.responseHeaders")
                              }}</span>
                              <ChevronDown
                                :class="[
                                  'h-3 w-3 transition-transform duration-200',
                                  httpHeadersOpen ? '' : '-rotate-90',
                                ]"
                              />
                            </button>
                            <div
                              v-show="httpHeadersOpen"
                              class="px-3 py-2 bg-muted/10 border-t border-dashed"
                            >
                              <pre
                                class="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/80 leading-relaxed"
                                >{{ parsedHttpResult.headersText }}</pre
                              >
                            </div>
                          </div>

                          <!-- Part 3: Response Body -->
                          <div
                            class="relative p-1 overflow-hidden"
                            :class="
                              parsedHttpResult.body.isImage ||
                              parsedHttpResult.body.isHtml
                                ? 'h-[300px]'
                                : 'min-h-[100px]'
                            "
                          >
                            <div
                              v-if="parsedHttpResult.body.isImage"
                              class="w-full h-full flex items-center justify-center bg-muted/20 border rounded-sm overflow-hidden"
                            >
                              <img
                                :src="parsedHttpResult.body.url"
                                class="max-h-full max-w-full object-contain shadow-sm"
                              />
                            </div>
                            <iframe
                              v-else-if="parsedHttpResult.body.isHtml"
                              :srcdoc="parsedHttpResult.body.content"
                              class="w-full h-full border rounded-sm bg-white"
                              sandbox="allow-scripts allow-same-origin"
                            ></iframe>
                            <Codemirror
                              v-else-if="parsedHttpResult.body.isText"
                              :model-value="parsedHttpResult.body.content"
                              :extensions="jsonExtensions"
                              class="text-[12px] w-full h-full"
                              disabled
                            />
                          </div>
                        </template>
                        <div v-else class="h-[200px] p-1">
                          <Codemirror
                            :model-value="
                              runResult
                                ? JSON.stringify(runResult, null, 2)
                                : ''
                            "
                            :placeholder="
                              t('dashboard.jsRuntime.logs.detailTitle')
                            "
                            :extensions="jsonExtensions"
                            class="h-full text-[12px]"
                            :style="{ height: '100%' }"
                            disabled
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div
                      v-if="!runResult && !runLoading"
                      class="h-[200px] flex flex-col items-center justify-center text-muted-foreground bg-muted/10 opacity-60"
                    >
                      <Inbox class="h-10 w-10 mb-2 opacity-20" />
                      <p class="text-xs">未执行，请先执行后查看结果</p>
                    </div>
                  </div>
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
              <Button
                @click="updateWorkerSettingsFun"
                :disabled="isActionPending"
              >
                <Loader2
                  v-if="settingsLoading"
                  class="mr-2 h-4 w-4 animate-spin"
                />
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
