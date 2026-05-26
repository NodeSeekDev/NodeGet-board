import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";

const LOG_STREAM_METHOD = "nodeget-server_stream_log";
const LOG_STREAM_UNSUBSCRIBE_METHOD = "nodeget-server_unsubscribe_stream_log";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_LOG_COUNT = 500;

export const LOG_TARGET_OPTIONS = [
  "server",
  "rpc",
  "db",
  "kv",
  "monitoring",
  "task",
  "token",
  "js_worker",
  "js_result",
  "crontab",
  "crontab_result",
  "js_runtime",
  "terminal",
] as const;

export const LOG_LEVEL_OPTIONS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
] as const;

export type LogTarget = (typeof LOG_TARGET_OPTIONS)[number];
export type LogLevel = (typeof LOG_LEVEL_OPTIONS)[number];
export type LogStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "paused"
  | "error";
export type LogActionStatus =
  | "idle"
  | "connecting"
  | "disconnecting"
  | "reconnecting"
  | "updatingFilters";

export interface LogFilterRule {
  target: LogTarget;
  level: LogLevel;
}

export interface LogSpan {
  name?: string;
  fields?: string;
}

export interface StreamLogEvent {
  timestamp: string;
  level: string;
  target: string;
  message: string;
  fields: Record<string, unknown>;
  spans: LogSpan[];
}

export interface LogEntry extends StreamLogEvent {
  id: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  method: string;
}

interface RpcErrorShape {
  message?: unknown;
  data?: unknown;
}

interface RpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

const isLogLevel = (value: string): value is LogLevel =>
  (LOG_LEVEL_OPTIONS as readonly string[]).includes(value);

const isLogTarget = (value: string): value is LogTarget =>
  (LOG_TARGET_OPTIONS as readonly string[]).includes(value);

const formatRpcError = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const rpcError = error as RpcErrorShape;
  const parts = [rpcError.message, rpcError.data].filter(Boolean).map(String);
  if (parts.length > 0) return parts.join(" | ");
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
};

const createRequestId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeLogEvent = (raw: unknown): StreamLogEvent | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    timestamp: String(record.timestamp ?? ""),
    level: String(record.level ?? "INFO"),
    target: String(record.target ?? "server"),
    message: String(record.message ?? ""),
    fields:
      record.fields && typeof record.fields === "object"
        ? (record.fields as Record<string, unknown>)
        : {},
    spans: Array.isArray(record.spans)
      ? record.spans
          .filter((span) => span && typeof span === "object")
          .map((span) => {
            const item = span as Record<string, unknown>;
            return {
              name: item.name ? String(item.name) : undefined,
              fields: item.fields ? String(item.fields) : undefined,
            };
          })
      : [],
  };
};

export const buildLogFilter = (
  filters: LogFilterRule[],
  defaultLevel: LogLevel,
): string => {
  const entries = filters
    .filter((item) => isLogTarget(item.target) && isLogLevel(item.level))
    .map((item) => `${item.target}=${item.level}`);

  if (entries.length > 0) {
    return entries.join(",");
  }

  return defaultLevel;
};

class LogWsClient {
  private ws: WebSocket | null = null;
  private url = "";
  private connectPromise: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private onLog: ((event: StreamLogEvent) => void) | null = null;
  private onClose: (() => void) | null = null;

  setLogHandler(handler: ((event: StreamLogEvent) => void) | null) {
    this.onLog = handler;
  }

  setCloseHandler(handler: (() => void) | null) {
    this.onClose = handler;
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(url: string) {
    if (!url) throw new Error("缺少 WebSocket 地址");
    if (this.ws?.readyState === WebSocket.OPEN && this.url === url) return;
    if (this.connectPromise && this.url === url) return this.connectPromise;
    if (this.url && this.url !== url) {
      this.disconnect();
    }

    this.url = url;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.connectPromise = null;
        resolve();
      };

      ws.onerror = () => {
        this.connectPromise = null;
        this.ws = null;
        reject(new Error(`WebSocket connection error: ${url}`));
      };

      ws.onclose = () => {
        this.connectPromise = null;
        this.rejectAllPending("connection closed");
        this.ws = null;
        this.onClose?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => this.handleMessage(item));
          return;
        }
        this.handleMessage(parsed);
      };
    });

    return this.connectPromise;
  }

  async request<T>(
    method: string,
    params: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    if (!this.url) throw new Error("WebSocket 尚未初始化");
    await this.connect(this.url);
    return new Promise<T>((resolve, reject) => {
      const id = createRequestId();
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} request timeout`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        method,
      });

      this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  disconnect() {
    this.rejectAllPending("connection closed");
    const ws = this.ws;
    this.ws = null;
    this.connectPromise = null;
    this.url = "";
    ws?.close();
  }

  private rejectAllPending(reason: string) {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timeout);
      req.reject(new Error(`${req.method} ${reason}`));
      this.pending.delete(id);
    }
  }

  private handleMessage(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const msg = raw as RpcMessage;

    if (msg.method === LOG_STREAM_METHOD) {
      const params =
        msg.params && typeof msg.params === "object"
          ? (msg.params as Record<string, unknown>)
          : null;
      const logEvent = normalizeLogEvent(params?.result);
      if (logEvent) this.onLog?.(logEvent);
      return;
    }

    const id = typeof msg.id === "string" ? msg.id : null;
    if (!id) return;

    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(id);

    if (msg.error) {
      pending.reject(
        new Error(formatRpcError(msg.error) || `${pending.method} rpc error`),
      );
      return;
    }

    if (
      msg.result &&
      typeof msg.result === "object" &&
      !Array.isArray(msg.result) &&
      "error_message" in msg.result
    ) {
      const result = msg.result as Record<string, unknown>;
      pending.reject(
        new Error(
          String(result.error_message || `${pending.method} rpc error`),
        ),
      );
      return;
    }

    pending.resolve(msg.result);
  }
}

const { currentBackend } = useBackendStore();
const backendUrl = computed(() => currentBackend.value?.url ?? "");
const backendToken = computed(() => currentBackend.value?.token?.trim() ?? "");

const logs = ref<LogEntry[]>([]);
const filters = ref<LogFilterRule[]>([]);
const defaultLevel = ref<LogLevel>("info");
const status = ref<LogStatus>("disconnected");
const actionStatus = ref<LogActionStatus>("idle");
const error = ref<string | null>(null);
const subscriptionId = ref<string | null>(null);

let logSequence = 0;
const client = new LogWsClient();

client.setLogHandler((event) => {
  if (status.value === "paused") return;
  logSequence += 1;
  logs.value.push({
    id: `${event.timestamp}-${logSequence}`,
    ...event,
  });
  if (logs.value.length > MAX_LOG_COUNT) {
    logs.value.splice(0, logs.value.length - MAX_LOG_COUNT);
  }
});

client.setCloseHandler(() => {
  subscriptionId.value = null;
  if (status.value !== "error" && status.value !== "disconnected") {
    status.value = "disconnected";
  }
});

const setFilters = async (nextFilters: LogFilterRule[]) => {
  const deduped: LogFilterRule[] = [];

  nextFilters.forEach((item) => {
    if (!isLogTarget(item.target) || !isLogLevel(item.level)) return;
    const exists = deduped.some(
      (entry) => entry.target === item.target && entry.level === item.level,
    );
    if (!exists) deduped.push(item);
  });

  const previousFilter = buildLogFilter(filters.value, defaultLevel.value);
  filters.value = deduped;
  const nextFilter = buildLogFilter(filters.value, defaultLevel.value);

  if (previousFilter !== nextFilter) {
    clearLogs();
  }

  if (
    previousFilter !== nextFilter &&
    (subscriptionId.value || status.value === "connecting")
  ) {
    actionStatus.value = "updatingFilters";
    await reconnect();
  }
};

const clearLogs = () => {
  logs.value = [];
};

const connect = async () => {
  if (!backendUrl.value) {
    status.value = "error";
    error.value = "当前后端缺少 WebSocket 地址";
    return;
  }
  if (!backendToken.value) {
    status.value = "error";
    error.value = "当前后端缺少 token";
    return;
  }

  error.value = null;
  status.value = "connecting";
  actionStatus.value = "connecting";

  try {
    await client.connect(backendUrl.value);
    subscriptionId.value = await client.request<string>(LOG_STREAM_METHOD, {
      token: backendToken.value,
      log_filter: buildLogFilter(filters.value, defaultLevel.value),
    });
    status.value = "connected";
  } catch (err: unknown) {
    status.value = "error";
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    actionStatus.value = "idle";
  }
};

const pause = () => {
  if (status.value === "connected") {
    status.value = "paused";
  }
};

const resume = () => {
  if (status.value === "paused") {
    status.value = "connected";
  }
};

const stop = async () => {
  const activeSubscriptionId = subscriptionId.value;
  subscriptionId.value = null;
  actionStatus.value = "disconnecting";

  try {
    if (activeSubscriptionId && client.isOpen()) {
      await client.request<boolean>(LOG_STREAM_UNSUBSCRIBE_METHOD, {
        subscription: activeSubscriptionId,
      });
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    client.disconnect();
    status.value = "disconnected";
    actionStatus.value = "idle";
  }
};

const reconnect = async () => {
  actionStatus.value = "reconnecting";
  const wasPaused = status.value === "paused";
  await stop();
  await connect();
  if (wasPaused && status.value === "connected") {
    status.value = "paused";
  }
  actionStatus.value = "idle";
};

watch(
  () => [backendUrl.value, backendToken.value],
  async (next, prev) => {
    if (!prev) return;
    if (next[0] === prev[0] && next[1] === prev[1]) return;
    if (status.value !== "disconnected") {
      await stop();
    }
    clearLogs();
    error.value = null;
  },
);

export function useLogs() {
  const { t } = useI18n();

  const isBusy = computed(() => actionStatus.value !== "idle");

  const connectWithLocale = async () => {
    if (!backendUrl.value) {
      status.value = "error";
      error.value = t("dashboard.logsPanel.errors.missingUrl");
      return;
    }
    if (!backendToken.value) {
      status.value = "error";
      error.value = t("dashboard.logsPanel.errors.missingToken");
      return;
    }

    error.value = null;
    status.value = "connecting";
    actionStatus.value = "connecting";

    try {
      await client.connect(backendUrl.value);
      subscriptionId.value = await client.request<string>(LOG_STREAM_METHOD, {
        token: backendToken.value,
        log_filter: buildLogFilter(filters.value, defaultLevel.value),
      });
      status.value = "connected";
    } catch (err: unknown) {
      status.value = "error";
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      actionStatus.value = "idle";
    }
  };

  return {
    logs,
    filters,
    defaultLevel,
    status,
    actionStatus,
    isBusy,
    error,
    subscriptionId,
    targetOptions: LOG_TARGET_OPTIONS,
    levelOptions: LOG_LEVEL_OPTIONS,
    connect: connectWithLocale,
    pause,
    resume,
    stop,
    reconnect,
    setFilters,
    clearLogs,
  };
}
