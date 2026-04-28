import { ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useBackendStore } from "./useBackendStore";
import { WsConnection, getWsConnection } from "./useWsConnection";
import { useKv } from "./useKv";
import type {
  DynamicSummaryResponseItem,
  SummaryField,
  DynamicDetailData,
} from "@/types/monitoring";

const POLL_INTERVAL_MS = 1000;
const UUIDS_REFRESH_MS = 60_000;
const RETRY_DELAY_MS = 10_000;

const summaryFields: SummaryField[] = [
  "cpu_usage",
  "gpu_usage",
  "used_swap",
  "total_swap",
  "used_memory",
  "total_memory",
  "available_memory",
  "load_one",
  "load_five",
  "load_fifteen",
  "uptime",
  "boot_time",
  "process_count",
  "total_space",
  "available_space",
  "read_speed",
  "write_speed",
  "tcp_connections",
  "udp_connections",
  "total_received",
  "total_transmitted",
  "transmit_speed",
  "receive_speed",
];

const dynamicStatus = ref<"disconnected" | "connecting" | "connected">(
  "disconnected",
);
const dynamicError = ref("");
const dynamicServers = ref<DynamicSummaryResponseItem[]>([]);

const { currentBackend } = useBackendStore();

let pollConn: WsConnection | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let uuidsTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pollInFlight = false;
let knownUuids: string[] = [];

function isTransientError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  if ((e as { code?: number }).code === 102) return true;
  const msg = String((e as { message?: unknown }).message || "").toLowerCase();
  return (
    msg.includes("connection pool") ||
    msg.includes("pool timed out") ||
    msg.includes("database error")
  );
}

function stopAllTimers() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (uuidsTimer) {
    clearInterval(uuidsTimer);
    uuidsTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function closeConnection() {
  stopAllTimers();
  if (pollConn) {
    pollConn.close();
    pollConn = null;
  }
  knownUuids = [];
}

async function refreshUuids() {
  const { listAgentUuids } = useKv();
  knownUuids = await listAgentUuids();
}

async function poll() {
  if (pollInFlight || !pollConn || !currentBackend.value) return;
  pollInFlight = true;
  try {
    if (knownUuids.length === 0) {
      await refreshUuids();
      if (knownUuids.length === 0) {
        dynamicServers.value = [];
        dynamicError.value = "";
        dynamicStatus.value = "connected";
        return;
      }
    }
    const result = await pollConn.call<DynamicSummaryResponseItem[]>(
      "agent_dynamic_summary_multi_last_query",
      {
        token: currentBackend.value.token,
        uuids: knownUuids,
        fields: summaryFields,
      },
    );
    if (Array.isArray(result)) {
      dynamicServers.value = result;
      dynamicError.value = "";
      dynamicStatus.value = "connected";
    }
  } catch (e) {
    console.error("[Dynamic] poll failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    dynamicError.value = msg;
    if (isTransientError(e)) {
      toast.error("数据查询失败", { description: msg });
      stopAllTimers();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        startPolling();
      }, RETRY_DELAY_MS);
    } else {
      dynamicStatus.value = "disconnected";
    }
  } finally {
    pollInFlight = false;
  }
}

function startPolling() {
  stopAllTimers();
  void poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  uuidsTimer = setInterval(() => {
    refreshUuids().catch((e) => {
      console.error("[Dynamic] periodic refreshUuids failed", e);
    });
  }, UUIDS_REFRESH_MS);
}

const connect = () => {
  if (!currentBackend.value) {
    dynamicError.value = "No backend selected.";
    dynamicStatus.value = "disconnected";
    return;
  }

  const { url, token } = currentBackend.value;
  if (!url || !token) {
    dynamicError.value = "Invalid backend configuration.";
    dynamicStatus.value = "disconnected";
    return;
  }

  closeConnection();
  dynamicStatus.value = "connecting";
  dynamicError.value = "";
  pollConn = new WsConnection(url);
  startPolling();
};

watch(
  currentBackend,
  (newVal, oldVal) => {
    if (newVal?.url === oldVal?.url && newVal?.token === oldVal?.token) return;
    closeConnection();
    dynamicStatus.value = "disconnected";
    dynamicServers.value = [];
    if (newVal) connect();
  },
  { deep: true },
);

const fetchSummaryAvg = async (
  serverUuid: string,
  options?: {
    timestamp_from?: number;
    timestamp_to?: number;
    limit?: number;
  },
  fields?: SummaryField[],
) => {
  if (!currentBackend.value) throw new Error("No backend selected");

  const queryFields = fields ?? [
    "cpu_usage",
    "used_memory",
    "total_memory",
    "read_speed",
    "write_speed",
    "transmit_speed",
    "receive_speed",
  ];

  const condition: Record<string, unknown>[] = [{ uuid: serverUuid }];
  if (options?.timestamp_from != null && options?.timestamp_to != null) {
    condition.push({
      timestamp_from_to: [options.timestamp_from, options.timestamp_to],
    });
  }
  if (options?.limit != null) condition.push({ limit: options.limit });

  return getWsConnection(currentBackend.value.url).call(
    "agent_query_dynamic_summary",
    [currentBackend.value.token, { fields: queryFields, condition }],
  );
};

const fetchDynamic = async (
  serverUuid: string,
  fields: string[],
  options?: { timestamp_from?: number; timestamp_to?: number; limit?: number },
): Promise<DynamicDetailData[]> => {
  if (!currentBackend.value) return [];
  const condition: Record<string, unknown>[] = [{ uuid: serverUuid }];
  if (options?.timestamp_from != null && options?.timestamp_to != null) {
    condition.push({
      timestamp_from_to: [options.timestamp_from, options.timestamp_to],
    });
  } else {
    condition.push({ last: null });
  }
  if (options?.limit != null) condition.push({ limit: options.limit });

  try {
    const result = await getWsConnection(currentBackend.value.url).call<
      DynamicDetailData[]
    >("agent_query_dynamic", [
      currentBackend.value.token,
      { fields, condition },
    ]);
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("[Dynamic] fetchDynamic failed:", e);
    toast.error("数据查询失败", {
      description: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
};

export function useDynamicData() {
  return {
    status: dynamicStatus,
    error: dynamicError,
    servers: dynamicServers,
    connect,
    fetchSummaryAvg,
    fetchDynamic,
  };
}
