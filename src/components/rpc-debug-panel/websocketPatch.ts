import type { Pinia } from "pinia";
import { watch, type WatchStopHandle } from "vue";
import { useSystemSettingsStore } from "@/stores/systemSettings";

export type RpcDebugWebSocketEvent =
  | {
      type: "connection";
      state: "connecting" | "open" | "error" | "closed";
      connectionId: number;
      url: string;
      timestamp: number;
      closeCode?: number;
      closeReason?: string;
    }
  | {
      type: "frame";
      direction: "outgoing" | "incoming";
      connectionId: number;
      url: string;
      timestamp: number;
      data: unknown;
    };

type NativeWebSocketCtor = typeof WebSocket;
type RpcDebugWebSocketListener = (event: RpcDebugWebSocketEvent) => void;

interface RpcDebugTrackedWebSocketConnection {
  connectionId: number;
  url: string;
  state: "connecting" | "open" | "error" | "closed";
  createdAt: number;
  openedAt?: number;
  closedAt?: number;
  closeCode?: number;
  closeReason?: string;
}

const listeners = new Set<RpcDebugWebSocketListener>();
const trackedConnections = new Map<
  number,
  RpcDebugTrackedWebSocketConnection
>();

let nativeWebSocket: NativeWebSocketCtor | null = null;
let installed = false;
let captureEnabled = false;
let nextConnectionId = 1;
let stopCaptureSettingWatch: WatchStopHandle | null = null;

function emit(event: RpcDebugWebSocketEvent) {
  if (!installed || !captureEnabled) return;
  listeners.forEach((listener) => listener(event));
}

export function addRpcDebugWebSocketListener(
  listener: RpcDebugWebSocketListener,
) {
  listeners.add(listener);
  if (captureEnabled) replayTrackedConnections(listener);
  return () => {
    listeners.delete(listener);
  };
}

function replayTrackedConnectionsToAllListeners() {
  listeners.forEach((listener) => replayTrackedConnections(listener));
}

function setRpcDebugCaptureEnabled(enabled: boolean) {
  if (captureEnabled === enabled) return;
  captureEnabled = enabled;
  if (enabled) replayTrackedConnectionsToAllListeners();
}

function bindRpcDebugCaptureSetting(pinia?: Pinia) {
  if (!pinia || stopCaptureSettingWatch) return;
  const systemSettingsStore = useSystemSettingsStore(pinia);
  setRpcDebugCaptureEnabled(systemSettingsStore.config.rpcDebugPanelEnabled);
  stopCaptureSettingWatch = watch(
    () => systemSettingsStore.config.rpcDebugPanelEnabled,
    setRpcDebugCaptureEnabled,
  );
}

function replayTrackedConnections(listener: RpcDebugWebSocketListener) {
  for (const connection of trackedConnections.values()) {
    createTrackedConnectionReplayEvents(connection).forEach(listener);
  }
}

function createTrackedConnectionReplayEvents(
  connection: RpcDebugTrackedWebSocketConnection,
) {
  const events: RpcDebugWebSocketEvent[] = [
    {
      type: "connection",
      state: "connecting",
      connectionId: connection.connectionId,
      url: connection.url,
      timestamp: connection.createdAt,
    },
  ];

  if (connection.state === "open") {
    events.push({
      type: "connection",
      state: "open",
      connectionId: connection.connectionId,
      url: connection.url,
      timestamp: connection.openedAt ?? connection.createdAt,
    });
    return events;
  }

  if (connection.state === "error") {
    events.push({
      type: "connection",
      state: "error",
      connectionId: connection.connectionId,
      url: connection.url,
      timestamp: Date.now(),
    });
    return events;
  }

  if (connection.state === "closed") {
    events.push({
      type: "connection",
      state: "closed",
      connectionId: connection.connectionId,
      url: connection.url,
      timestamp: connection.closedAt ?? connection.createdAt,
      closeCode: connection.closeCode,
      closeReason: connection.closeReason,
    });
  }

  return events;
}

export function installRpcDebugWebSocketPatch(pinia?: Pinia) {
  bindRpcDebugCaptureSetting(pinia);
  if (installed || typeof window === "undefined") return;

  nativeWebSocket = window.WebSocket;
  const OriginalWebSocket = nativeWebSocket;

  class DebugWebSocket extends OriginalWebSocket {
    readonly __rpcDebugConnectionId: number;
    readonly __rpcDebugUrl: string;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols as string | string[] | undefined);
      this.__rpcDebugConnectionId = nextConnectionId++;
      this.__rpcDebugUrl = String(url);
      const timestamp = Date.now();

      trackedConnections.set(this.__rpcDebugConnectionId, {
        connectionId: this.__rpcDebugConnectionId,
        url: this.__rpcDebugUrl,
        state: "connecting",
        createdAt: timestamp,
      });

      emit({
        type: "connection",
        state: "connecting",
        connectionId: this.__rpcDebugConnectionId,
        url: this.__rpcDebugUrl,
        timestamp,
      });

      this.addEventListener("open", () => {
        const openedAt = Date.now();
        const connection = trackedConnections.get(this.__rpcDebugConnectionId);
        if (connection) {
          connection.state = "open";
          connection.openedAt = openedAt;
        }
        emit({
          type: "connection",
          state: "open",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: openedAt,
        });
      });

      this.addEventListener("message", (event) => {
        emit({
          type: "frame",
          direction: "incoming",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
          data: event.data,
        });
      });

      this.addEventListener("error", () => {
        const connection = trackedConnections.get(this.__rpcDebugConnectionId);
        if (connection) connection.state = "error";
        emit({
          type: "connection",
          state: "error",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
        });
      });

      this.addEventListener("close", (event) => {
        const closedAt = Date.now();
        const connection = trackedConnections.get(this.__rpcDebugConnectionId);
        if (connection) {
          connection.state = "closed";
          connection.closedAt = closedAt;
          connection.closeCode = event.code;
          connection.closeReason = event.reason;
        }
        emit({
          type: "connection",
          state: "closed",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: closedAt,
          closeCode: event.code,
          closeReason: event.reason,
        });
      });
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      emit({
        type: "frame",
        direction: "outgoing",
        connectionId: this.__rpcDebugConnectionId,
        url: this.__rpcDebugUrl,
        timestamp: Date.now(),
        data,
      });
      return super.send(data);
    }
  }

  window.WebSocket = DebugWebSocket as NativeWebSocketCtor;
  installed = true;
}

export function uninstallRpcDebugWebSocketPatch() {
  if (!installed || !nativeWebSocket || typeof window === "undefined") return;
  window.WebSocket = nativeWebSocket;
  nativeWebSocket = null;
  installed = false;
  captureEnabled = false;
  stopCaptureSettingWatch?.();
  stopCaptureSettingWatch = null;
  trackedConnections.clear();
}
