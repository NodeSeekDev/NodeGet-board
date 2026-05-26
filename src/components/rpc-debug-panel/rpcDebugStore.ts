import { computed, reactive, ref } from "vue";
import {
  addRpcDebugWebSocketListener,
  type RpcDebugWebSocketEvent,
} from "./websocketPatch";

export type RpcDebugRecordKind =
  | "call"
  | "subscription"
  | "notification"
  | "batch"
  | "raw";

export type RpcDebugRecordStatus =
  | "pending"
  | "success"
  | "error"
  | "streaming"
  | "closed"
  | "raw";

export interface RpcDebugRecord {
  recordId: string;
  connectionId: number;
  url: string;
  method: string;
  id?: string;
  subscription?: string;
  kind: RpcDebugRecordKind;
  status: RpcDebugRecordStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  request?: unknown;
  response?: unknown;
  error?: unknown;
  direction: "outgoing" | "incoming" | "duplex";
  note?: string;
}

export interface RpcDebugConnection {
  connectionId: number;
  url: string;
  state: "connecting" | "open" | "closed" | "error";
  createdAt: number;
  openedAt?: number;
  closedAt?: number;
  closeCode?: number;
  closeReason?: string;
}

export interface RpcDebugSettings {
  maxRecords: number;
  maskTokens: boolean;
  captureNotifications: boolean;
  captureRawFrames: boolean;
  formatJson: boolean;
}

type JsonRpcLike = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

const records = ref<RpcDebugRecord[]>([]);
const selectedRecordId = ref<string | null>(null);
const isPaused = ref(false);
const settings = reactive<RpcDebugSettings>({
  maxRecords: 500,
  maskTokens: true,
  captureNotifications: true,
  captureRawFrames: false,
  formatJson: true,
});

const connections = reactive(new Map<number, RpcDebugConnection>());
const pendingByRpcId = new Map<string, string>();

let nextRecordId = 1;

const sensitiveKeys = new Set([
  "token",
  "supertoken",
  "father_token",
  "password",
  "authorization",
  "secret",
  "token_secret",
]);

function methodTokenInFirstArrayParam(method: string) {
  return /^(agent_|task_|kv_|crontab_|js-|js_|token_|nodeget-server_)/.test(
    method,
  );
}

function now() {
  return Date.now();
}

function makeRecordId() {
  return `rpc-debug-${nextRecordId++}`;
}

function pendingKey(connectionId: number, id: unknown) {
  return `${connectionId}:${String(id)}`;
}

function parseFrame(data: unknown): unknown {
  if (typeof data !== "string") return null;
  const text = data.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeJsonRpc(value: unknown): value is JsonRpcLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const msg = value as JsonRpcLike;
  return msg.jsonrpc === "2.0" || "method" in msg || "id" in msg;
}

export function maskDebugValue(value: unknown, method = ""): unknown {
  if (!settings.maskTokens) return value;
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      index === 0 &&
      typeof item === "string" &&
      methodTokenInFirstArrayParam(method)
        ? maskToken(item)
        : maskDebugValue(item, method),
    );
  }
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const masked: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    masked[key] = sensitiveKeys.has(key.toLowerCase())
      ? maskToken(item)
      : maskDebugValue(item, method);
  }
  return masked;
}

export function maskToken(value: unknown) {
  if (typeof value !== "string") return "••••••";
  if (value.length <= 8) return "••••••";
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

export function formatDebugPayload(value: unknown, method = "") {
  const safeValue = maskDebugValue(value, method);
  if (typeof safeValue === "string") return safeValue;
  try {
    return JSON.stringify(safeValue, null, settings.formatJson ? 2 : 0);
  } catch {
    return String(safeValue);
  }
}

function trimRecords() {
  const overflow = records.value.length - settings.maxRecords;
  if (overflow > 0) records.value.splice(0, overflow);
}

function appendRecord(record: RpcDebugRecord) {
  if (isPaused.value) return;
  records.value.push(record);
  trimRecords();
}

function updateRecord(recordId: string, patch: Partial<RpcDebugRecord>) {
  if (isPaused.value) return;
  const record = records.value.find((item) => item.recordId === recordId);
  if (!record) return;
  Object.assign(record, patch);
}

function recordOutgoingRpc(
  connectionId: number,
  url: string,
  msg: JsonRpcLike,
) {
  const method =
    typeof msg.method === "string" ? msg.method : "JSON-RPC Request";
  const id = msg.id == null ? undefined : String(msg.id);
  const recordId = makeRecordId();
  const isSubscription = method.includes("stream_");
  const record: RpcDebugRecord = {
    recordId,
    connectionId,
    url,
    method,
    id,
    kind: isSubscription ? "subscription" : "call",
    status: isSubscription ? "streaming" : "pending",
    startedAt: now(),
    request: msg,
    direction: "outgoing",
  };

  appendRecord(record);
  if (id != null) pendingByRpcId.set(pendingKey(connectionId, id), recordId);
}

function recordIncomingRpc(
  connectionId: number,
  url: string,
  msg: JsonRpcLike,
) {
  const id = msg.id == null ? undefined : String(msg.id);
  const method =
    typeof msg.method === "string" ? msg.method : "JSON-RPC Response";

  if (id != null) {
    const key = pendingKey(connectionId, id);
    const recordId = pendingByRpcId.get(key);
    if (recordId) {
      pendingByRpcId.delete(key);
      const endedAt = now();
      const record = records.value.find((item) => item.recordId === recordId);
      updateRecord(recordId, {
        response: msg,
        error: msg.error,
        status: msg.error ? "error" : "success",
        endedAt,
        durationMs: record ? endedAt - record.startedAt : undefined,
        direction: "duplex",
      });
      return;
    }
  }

  if (typeof msg.method === "string" && msg.id == null) {
    if (!settings.captureNotifications) return;
    const params =
      msg.params && typeof msg.params === "object"
        ? (msg.params as Record<string, unknown>)
        : {};
    appendRecord({
      recordId: makeRecordId(),
      connectionId,
      url,
      method,
      subscription:
        typeof params.subscription === "string"
          ? params.subscription
          : undefined,
      kind: "notification",
      status: "success",
      startedAt: now(),
      response: msg,
      direction: "incoming",
    });
    return;
  }

  appendRecord({
    recordId: makeRecordId(),
    connectionId,
    url,
    method,
    id,
    kind: "call",
    status: msg.error ? "error" : "success",
    startedAt: now(),
    response: msg,
    error: msg.error,
    direction: "incoming",
    note: "未找到匹配请求",
  });
}

function recordRawFrame(
  connectionId: number,
  url: string,
  direction: "incoming" | "outgoing",
  data: unknown,
) {
  if (!settings.captureRawFrames) return;
  appendRecord({
    recordId: makeRecordId(),
    connectionId,
    url,
    method: "Raw WebSocket",
    kind: "raw",
    status: "raw",
    startedAt: now(),
    request: direction === "outgoing" ? data : undefined,
    response: direction === "incoming" ? data : undefined,
    direction,
    note: "非 JSON-RPC 帧",
  });
}

function handleOutgoingFrame(connectionId: number, url: string, data: unknown) {
  const parsed = parseFrame(data);
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (looksLikeJsonRpc(item)) recordOutgoingRpc(connectionId, url, item);
    });
    return;
  }
  if (looksLikeJsonRpc(parsed) && typeof parsed.method === "string") {
    recordOutgoingRpc(connectionId, url, parsed);
    return;
  }
  recordRawFrame(connectionId, url, "outgoing", data);
}

function handleIncomingFrame(connectionId: number, url: string, data: unknown) {
  const parsed = parseFrame(data);
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (looksLikeJsonRpc(item)) recordIncomingRpc(connectionId, url, item);
    });
    return;
  }
  if (looksLikeJsonRpc(parsed)) {
    recordIncomingRpc(connectionId, url, parsed);
    return;
  }
  recordRawFrame(connectionId, url, "incoming", data);
}

function markConnectionState(
  connectionId: number,
  url: string,
  patch: Partial<RpcDebugConnection>,
) {
  let connection = connections.get(connectionId);
  if (!connection) {
    connection = {
      connectionId,
      url,
      state: "connecting",
      createdAt: patch.createdAt ?? now(),
    };
    connections.set(connectionId, connection);
  }
  if (connection) Object.assign(connection, patch);
}

function handlePatchEvent(event: RpcDebugWebSocketEvent) {
  if (event.type === "connection") {
    if (event.state === "connecting") {
      connections.set(event.connectionId, {
        connectionId: event.connectionId,
        url: event.url,
        state: "connecting",
        createdAt: event.timestamp,
      });
      return;
    }

    if (event.state === "open") {
      markConnectionState(event.connectionId, event.url, {
        state: "open",
        openedAt: event.timestamp,
      });
      return;
    }

    if (event.state === "error") {
      markConnectionState(event.connectionId, event.url, { state: "error" });
      return;
    }

    markConnectionState(event.connectionId, event.url, {
      state: "closed",
      closedAt: event.timestamp,
      closeCode: event.closeCode,
      closeReason: event.closeReason,
    });
    return;
  }

  markConnectionState(event.connectionId, event.url, {
    state: "open",
  });

  if (event.direction === "outgoing") {
    handleOutgoingFrame(event.connectionId, event.url, event.data);
    return;
  }

  handleIncomingFrame(event.connectionId, event.url, event.data);
}

export function registerRpcDebugEventHandler() {
  return addRpcDebugWebSocketListener(handlePatchEvent);
}

export function clearRpcDebugRecords() {
  records.value = [];
  pendingByRpcId.clear();
  selectedRecordId.value = null;
}

export function exportRpcDebugRecords() {
  const data = records.value.map((record) => ({
    ...record,
    request: maskDebugValue(record.request, record.method),
    response: maskDebugValue(record.response, record.method),
  }));
  return JSON.stringify(data, null, 2);
}

export function useRpcDebugStore() {
  const selectedRecord = computed(() =>
    records.value.find((item) => item.recordId === selectedRecordId.value),
  );
  const connectionList = computed(() =>
    [...connections.values()].sort((a, b) => b.createdAt - a.createdAt),
  );
  const activeConnectionCount = computed(
    () => connectionList.value.filter((item) => item.state === "open").length,
  );
  return {
    records,
    selectedRecordId,
    selectedRecord,
    isPaused,
    settings,
    connections: connectionList,
    activeConnectionCount,
    clear: clearRpcDebugRecords,
    exportRecords: exportRpcDebugRecords,
  };
}
