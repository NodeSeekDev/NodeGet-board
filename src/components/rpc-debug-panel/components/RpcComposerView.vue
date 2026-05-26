<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Copy, FileText, Send, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  maskToken,
  type RpcDebugRecord,
  useRpcDebugStore,
} from "../rpcDebugStore";
import {
  backendKey,
  methodCatalog,
  methodHints,
  rpcDebugCommandFilter,
} from "../helpers";
import { buildRpcMethodParams } from "../rpcMethodCatalog";
import type { ComposerDraft } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComposerSourceRecord {
  recordId: string;
  method: string;
}

const props = defineProps<{
  pendingRecord?: RpcDebugRecord | null;
}>();

const emit = defineEmits<{
  copied: [message?: string];
  consumedRecord: [];
  showSourceRecord: [recordId: string];
}>();

const debugStore = useRpcDebugStore();
const backendStore = useBackendStore();
const NO_BACKEND_VALUE = "__none__";
const methodFocused = ref(false);
const composerSource = ref<ComposerSourceRecord | null>(null);

const backendOptions = computed(() => backendStore.backends.value);
const currentBackendKey = computed(() =>
  backendStore.currentBackend.value
    ? backendKey(backendStore.currentBackend.value)
    : "",
);

const composer = reactive<ComposerDraft>({
  method: "nodeget-server_hello",
  requestId: "",
  backendKey: "",
  paramsText: "[]",
  sending: false,
  responseText: "尚未发送请求",
  responseMeta: "等待发送",
  responseMethod: "",
});

const selectedBackend = computed(() =>
  backendOptions.value.find((item) => backendKey(item) === composer.backendKey),
);

const sourceRecordIndex = computed(() => {
  if (!composerSource.value) return null;
  const index = debugStore.records.value.findIndex(
    (record) => record.recordId === composerSource.value?.recordId,
  );
  return index >= 0 ? index + 1 : null;
});

const sourceRecordLinkText = computed(() =>
  sourceRecordIndex.value ? `#${sourceRecordIndex.value}` : "#?",
);

const responseMethodTag = computed(
  () => composer.responseMethod || composer.method.trim() || "-",
);

watch(
  currentBackendKey,
  (key) => {
    if (!composer.backendKey) composer.backendKey = key;
  },
  { immediate: true },
);

watch(
  () => props.pendingRecord,
  (record) => {
    if (!record) return;
    const req =
      record.request && typeof record.request === "object"
        ? (record.request as { method?: unknown; params?: unknown })
        : null;
    composer.method =
      typeof req?.method === "string" ? req.method : record.method;
    composer.requestId = "";
    composer.paramsText = formatRawComposerPayload(req?.params ?? {});
    composer.responseText = "尚未发送请求";
    composer.responseMeta = "等待发送";
    composer.responseMethod = "";
    composerSource.value = {
      recordId: record.recordId,
      method: record.method,
    };
    emit("consumedRecord");
  },
  { immediate: true },
);

async function copyText(text: string, message?: string) {
  await navigator.clipboard.writeText(text);
  emit("copied", message);
}

function selectMethodSuggestion(method: string) {
  composer.method = method;
  methodFocused.value = false;
  fillDefaultParams();
}

function clearComposerDraft() {
  composer.method = "";
  composer.requestId = "";
  composer.backendKey = "";
  composer.paramsText = "";
  composer.responseText = "尚未发送请求";
  composer.responseMeta = "等待发送";
  composer.responseMethod = "";
  composerSource.value = null;
  methodFocused.value = false;
}

function showSourceRecord() {
  if (!composerSource.value) return;
  emit("showSourceRecord", composerSource.value.recordId);
}

function handleMethodFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  methodFocused.value = false;
}

function handleBackendSelectionChange(value: unknown) {
  composer.backendKey =
    typeof value === "string" && value !== NO_BACKEND_VALUE ? value : "";
  fillDefaultParams();
}

function formatRawComposerPayload(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  return (
    JSON.stringify(value, null, debugStore.settings.formatJson ? 2 : 0) ?? ""
  );
}

function fillDefaultParams() {
  const token = selectedBackend.value?.token ?? "";
  const method = composer.method.trim();
  const templateParams = buildRpcMethodParams(method, token);
  if (templateParams !== undefined) {
    composer.paramsText = formatRawComposerPayload(templateParams);
    return;
  }
  composer.paramsText = JSON.stringify({ token }, null, 2);
}

function parseComposerParams() {
  const text = composer.paramsText.trim();
  if (!text) return [];
  return JSON.parse(text) as unknown;
}

async function sendComposerRequest() {
  const backend = selectedBackend.value;
  if (!backend?.url) {
    toast.error("请选择后端凭据");
    return;
  }
  composer.sending = true;
  composer.responseMeta = "发送中";
  const method = composer.method.trim();
  composer.responseMethod = method;
  const startedAt = performance.now();
  try {
    const result = await getWsConnection(backend.url).call<unknown>(
      method,
      parseComposerParams(),
      10000,
      {
        idPrefix: "debug-",
        onRequestId: (id) => {
          composer.requestId = id;
        },
      },
    );
    const duration = Math.round(performance.now() - startedAt);
    composer.responseMeta = `成功 · ${duration}ms`;
    composer.responseText =
      typeof result === "string"
        ? result
        : JSON.stringify(
            result ?? null,
            null,
            debugStore.settings.formatJson ? 2 : 0,
          );
  } catch (error) {
    composer.responseMeta = "错误";
    composer.responseText =
      error instanceof Error ? error.message : String(error);
  } finally {
    composer.sending = false;
  }
}
</script>

<template>
  <div
    class="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden p-4 lg:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] lg:grid-rows-none"
  >
    <section
      class="flex min-h-0 flex-col overflow-hidden rounded-md border bg-background"
    >
      <div
        class="flex min-h-10 flex-none items-center justify-between gap-3 border-b px-3 py-1.5"
      >
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 class="shrink-0 text-sm font-semibold">构造请求</h2>
            <Badge
              v-if="composerSource"
              variant="outline"
              class="h-5 rounded px-1.5 text-[10px] text-blue-700 dark:text-blue-300"
            >
              来自网络
            </Badge>
            <Badge
              v-else
              variant="outline"
              class="h-5 rounded px-1.5 text-[10px] text-muted-foreground"
            >
              手动
            </Badge>
          </div>
          <div
            v-if="composerSource"
            class="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs leading-none text-muted-foreground"
          >
            <span class="shrink-0">记录</span>
            <Button
              variant="link"
              class="h-auto shrink-0 p-0 text-xs font-semibold text-blue-700 underline-offset-4 dark:text-blue-300"
              type="button"
              @click="showSourceRecord"
            >
              {{ sourceRecordLinkText }}
            </Button>
            <span class="shrink-0">带入</span>
            <span
              class="min-w-0 truncate font-mono text-[11px] text-foreground"
            >
              {{ composerSource.method }}
            </span>
          </div>
        </div>
        <Button
          v-if="composerSource"
          variant="ghost"
          size="sm"
          class="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          type="button"
          :disabled="composer.sending"
          @click="clearComposerDraft"
        >
          <Trash2 class="size-3.5" />
          清除带入
        </Button>
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-3 p-3">
          <div class="relative grid gap-1.5">
            <Label class="text-xs text-muted-foreground">方法</Label>
            <Command
              :filter="rpcDebugCommandFilter"
              :highlight-on-hover="true"
              class="relative h-9 overflow-visible rounded-md border bg-background shadow-none **:data-[slot=command-input]:h-8 **:data-[slot=command-input]:py-1 **:data-[slot=command-input]:text-xs **:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input-wrapper]:border-b-0 **:data-[slot=command-input-wrapper]:px-2.5"
              @focusout="handleMethodFocusOut"
            >
              <CommandInput
                v-model="composer.method"
                :auto-focus="false"
                placeholder="nodeget-server_hello"
                @focus="methodFocused = true"
                @click="methodFocused = true"
                @keydown.esc.stop="methodFocused = false"
              />
              <CommandList
                v-if="methodFocused"
                class="absolute top-full left-0 z-50 mt-1 max-h-64 w-full rounded-md border bg-popover shadow-md"
                @mousedown.prevent
              >
                <CommandEmpty class="py-3 text-xs"> 暂无匹配方法 </CommandEmpty>
                <CommandGroup heading="方法">
                  <CommandItem
                    v-for="method in methodCatalog"
                    :key="method"
                    keep-search-on-select
                    :value="method"
                    class="justify-between gap-3 text-xs"
                    @select="selectMethodSuggestion(method)"
                  >
                    <span class="min-w-0 truncate font-mono text-xs">
                      {{ method }}
                    </span>
                    <span
                      class="max-w-24 shrink-0 truncate text-xs text-muted-foreground"
                    >
                      {{ methodHints[method] ?? "RPC" }}
                    </span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground">请求 ID</Label>
              <Input
                v-model="composer.requestId"
                class="h-8 px-2.5 font-mono text-xs"
                disabled
                placeholder="debug-<random_id>"
              />
            </div>
            <div class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground">鉴权来源</Label>
              <Select
                :model-value="composer.backendKey || NO_BACKEND_VALUE"
                @update:model-value="handleBackendSelectionChange"
              >
                <SelectTrigger size="sm" class="h-8 w-full px-2.5 text-xs">
                  <SelectValue placeholder="未选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_BACKEND_VALUE">未选择</SelectItem>
                  <SelectItem
                    v-for="backend in backendOptions"
                    :key="backendKey(backend)"
                    :value="backendKey(backend)"
                  >
                    {{ backend.name }} / {{ maskToken(backend.token) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="grid gap-1.5">
            <Label class="text-xs text-muted-foreground">参数 JSON</Label>
            <Textarea
              v-model="composer.paramsText"
              class="min-h-40 resize-y px-2.5 py-2 font-mono text-xs leading-relaxed"
            />
          </div>

          <div class="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              class="h-8 gap-1.5 px-2.5 text-xs"
              type="button"
              :disabled="composer.sending"
              @click="sendComposerRequest"
            >
              <Send class="size-3.5" />
              {{ composer.sending ? "发送中" : "发送" }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 px-2.5 text-xs"
              type="button"
              @click="copyText(composer.paramsText, '参数 JSON 已复制')"
            >
              <Copy class="size-3.5" />
              复制 JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 px-2.5 text-xs"
              type="button"
              :disabled="composer.sending"
              @click="fillDefaultParams"
            >
              <FileText class="size-3.5" />
              填入模板
            </Button>
          </div>
        </div>
      </ScrollArea>
    </section>

    <section
      class="flex min-h-0 flex-col overflow-hidden rounded-md border bg-background"
    >
      <div
        class="flex min-h-10 flex-none items-center justify-between gap-3 border-b px-3 py-1.5"
      >
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1.5">
            <h2 class="shrink-0 text-sm font-semibold">响应结果</h2>
            <Badge
              variant="outline"
              class="h-5 max-w-full min-w-0 rounded px-1.5 text-[10px]"
            >
              <span class="font-medium">method:</span>
              <span class="min-w-0 truncate font-mono">
                {{ responseMethodTag }}
              </span>
            </Badge>
          </div>
          <p class="mt-1 truncate text-xs leading-none text-muted-foreground">
            {{ composer.responseMeta }}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs"
          type="button"
          @click="copyText(composer.responseText, '响应结果已复制')"
        >
          <Copy class="size-3.5" />
          复制结果
        </Button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col p-3">
        <Textarea
          :model-value="composer.responseText"
          readonly
          class="h-full min-h-0 resize-none px-2.5 py-2 font-mono text-xs leading-relaxed"
        />
      </div>
    </section>
  </div>
</template>
