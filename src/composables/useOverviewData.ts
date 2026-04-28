import { ref } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { WsConnection, getWsConnection } from "@/composables/useWsConnection";
import { useKv } from "@/composables/useKv";
import type { SummaryField } from "@/types/monitoring";

const SUMMARY_FIELDS: SummaryField[] = [
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
const STATIC_FIELDS = ["cpu", "system", "gpu"];
const POLL_INTERVAL_MS = 1000;
const STATIC_POLL_INTERVAL_MS = 60_000;

type AgentRow = { uuid: string; [key: string]: unknown };

export interface OverviewServer {
  uuid: string;
  // summary flat fields
  cpu_usage?: number;
  gpu_usage?: number;
  used_swap?: number;
  total_swap?: number;
  used_memory?: number;
  total_memory?: number;
  available_memory?: number;
  load_one?: number;
  load_five?: number;
  load_fifteen?: number;
  uptime?: number;
  boot_time?: number;
  process_count?: number;
  total_space?: number;
  available_space?: number;
  read_speed?: number;
  write_speed?: number;
  tcp_connections?: number;
  udp_connections?: number;
  total_received?: number;
  total_transmitted?: number;
  transmit_speed?: number;
  receive_speed?: number;
  // static fields
  system?: Record<string, unknown>;
  gpu?: unknown[];
  // kv metadata
  customName: string;
  hidden: boolean;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
  tags: string[];
}

const servers = ref<OverviewServer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const inactive = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let staticPollTimer: ReturnType<typeof setInterval> | null = null;
let pollConn: WsConnection | null = null;
let visibilityListenerAttached = false;
let uuids: string[] = [];
let metaMap = new Map<
  string,
  {
    customName: string;
    hidden: boolean;
    region: string;
    latitude: number | null;
    longitude: number | null;
    tags: string[];
  }
>();
let staticMap = new Map<string, AgentRow>();
let fetchDynamicInFlight = false;
let fetchStaticInFlight = false;
let refCount = 0;

// 依赖 Vue/Pinia 的函数，在首次调用时懒初始化
type AsyncFn = () => Promise<void>;
let _fetchUuidsAndMeta: AsyncFn | null = null;
let _fetchStatic: AsyncFn | null = null;
let _fetchDynamic: AsyncFn | null = null;
let _fetchStaticPeriodic: AsyncFn | null = null;

function initFunctions() {
  if (_fetchUuidsAndMeta) return;

  const { currentBackend } = useBackendStore();
  const kv = useKv();
  const conn = () => getWsConnection(currentBackend.value?.url ?? "");

  _fetchUuidsAndMeta = async () => {
    try {
      uuids = await kv.listAgentUuids();
    } catch {
      uuids = [];
    }

    if (uuids.length === 0) return;

    try {
      const namespaceKeys = uuids.flatMap((uuid) => [
        { namespace: uuid, key: "metadata_name" },
        { namespace: uuid, key: "metadata_hidden" },
        { namespace: uuid, key: "metadata_region" },
        { namespace: uuid, key: "metadata_latitude" },
        { namespace: uuid, key: "metadata_longitude" },
        { namespace: uuid, key: "metadata_tags" },
      ]);
      const results = await kv.getMultiValue(namespaceKeys);
      metaMap = new Map();
      const parseNullableNumber = (value: unknown): number | null => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const parseTags = (value: unknown): string[] =>
        Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
      for (const uuid of uuids) {
        const nameEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_name",
        );
        const hiddenEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_hidden",
        );
        const regionEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_region",
        );
        const latitudeEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_latitude",
        );
        const longitudeEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_longitude",
        );
        const tagsEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_tags",
        );
        metaMap.set(uuid, {
          customName: nameEntry ? String(nameEntry.value ?? "") : "",
          hidden: hiddenEntry ? Boolean(hiddenEntry.value) : false,
          region: regionEntry ? String(regionEntry.value ?? "") : "",
          latitude: parseNullableNumber(latitudeEntry?.value),
          longitude: parseNullableNumber(longitudeEntry?.value),
          tags: parseTags(tagsEntry?.value),
        });
      }
    } catch {
      metaMap = new Map();
    }
  };

  _fetchStatic = async () => {
    if (!currentBackend.value || uuids.length === 0) return;
    try {
      const results = await conn().call<AgentRow[]>(
        "agent_static_data_multi_last_query",
        { token: currentBackend.value.token, uuids, fields: STATIC_FIELDS },
      );
      staticMap = new Map();
      for (const s of Array.isArray(results) ? results : []) {
        staticMap.set(s.uuid, s);
      }
    } catch {
      // 失败时保留上次缓存
    }
  };

  _fetchDynamic = async () => {
    if (!currentBackend.value || uuids.length === 0) return;
    if (fetchDynamicInFlight) return;
    fetchDynamicInFlight = true;

    try {
      if (!pollConn) pollConn = new WsConnection(currentBackend.value.url);
      const results = await pollConn.call<AgentRow[]>(
        "agent_dynamic_summary_multi_last_query",
        { token: currentBackend.value.token, uuids, fields: SUMMARY_FIELDS },
      );

      const dynamicMap = new Map<string, AgentRow>();
      for (const d of Array.isArray(results) ? results : []) {
        dynamicMap.set(d.uuid, d);
      }

      if (
        typeof document === "undefined" ||
        document.visibilityState === "visible"
      ) {
        inactive.value = false;
      }
      servers.value = uuids.map((uuid) => {
        const d = dynamicMap.get(uuid) ?? { uuid };
        const s = staticMap.get(uuid) ?? { uuid };
        const meta = metaMap.get(uuid) ?? {
          customName: "",
          hidden: false,
          region: "",
          latitude: null,
          longitude: null,
          tags: [],
        };

        return {
          uuid,
          // summary flat fields
          timestamp: d.timestamp as number | undefined,
          cpu_usage: d.cpu_usage as number | undefined,
          gpu_usage: d.gpu_usage as number | undefined,
          used_swap: d.used_swap as number | undefined,
          total_swap: d.total_swap as number | undefined,
          used_memory: d.used_memory as number | undefined,
          total_memory: d.total_memory as number | undefined,
          available_memory: d.available_memory as number | undefined,
          load_one: d.load_one as number | undefined,
          load_five: d.load_five as number | undefined,
          load_fifteen: d.load_fifteen as number | undefined,
          uptime: d.uptime as number | undefined,
          boot_time: d.boot_time as number | undefined,
          process_count: d.process_count as number | undefined,
          total_space: d.total_space as number | undefined,
          available_space: d.available_space as number | undefined,
          read_speed: d.read_speed as number | undefined,
          write_speed: d.write_speed as number | undefined,
          tcp_connections: d.tcp_connections as number | undefined,
          udp_connections: d.udp_connections as number | undefined,
          total_received: d.total_received as number | undefined,
          total_transmitted: d.total_transmitted as number | undefined,
          transmit_speed: d.transmit_speed as number | undefined,
          receive_speed: d.receive_speed as number | undefined,
          // static fields (system info, gpu)
          system: s.system as Record<string, unknown> | undefined,
          gpu: (s.gpu ?? []) as unknown[],
          // kv metadata
          customName: meta.customName,
          hidden: meta.hidden,
          region: meta.region,
          latitude: meta.latitude,
          longitude: meta.longitude,
          tags: meta.tags,
        };
      });

      if (error.value) error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      fetchDynamicInFlight = false;
    }
  };

  _fetchStaticPeriodic = async () => {
    if (fetchStaticInFlight) return;
    fetchStaticInFlight = true;
    try {
      let latestUuids: string[];
      try {
        latestUuids = await kv.listAgentUuids();
      } catch {
        return;
      }

      const knownSet = new Set(uuids);
      const newUuids = latestUuids.filter((u) => !knownSet.has(u));
      if (newUuids.length === 0) return;

      // 拉取新 UUID 的 static 数据
      if (currentBackend.value) {
        try {
          const results = await conn().call<AgentRow[]>(
            "agent_static_data_multi_last_query",
            {
              token: currentBackend.value.token,
              uuids: newUuids,
              fields: STATIC_FIELDS,
            },
          );
          for (const s of Array.isArray(results) ? results : []) {
            staticMap.set(s.uuid, s);
          }
        } catch {
          // 失败时 staticMap 无数据，fetchDynamic 用 { uuid } fallback
        }
      }

      // 拉取新 UUID 的 KV metadata
      try {
        const namespaceKeys = newUuids.flatMap((uuid) => [
          { namespace: uuid, key: "metadata_name" },
          { namespace: uuid, key: "metadata_hidden" },
          { namespace: uuid, key: "metadata_region" },
          { namespace: uuid, key: "metadata_latitude" },
          { namespace: uuid, key: "metadata_longitude" },
          { namespace: uuid, key: "metadata_tags" },
        ]);
        const kvResults = await kv.getMultiValue(namespaceKeys);
        const parseNullableNumber = (value: unknown): number | null => {
          if (value === null || value === undefined || value === "")
            return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };
        const parseTags = (value: unknown): string[] =>
          Array.isArray(value)
            ? value.map((v) => String(v)).filter(Boolean)
            : [];
        for (const uuid of newUuids) {
          const nameEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_name",
          );
          const hiddenEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_hidden",
          );
          const regionEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_region",
          );
          const latitudeEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_latitude",
          );
          const longitudeEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_longitude",
          );
          const tagsEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_tags",
          );
          metaMap.set(uuid, {
            customName: nameEntry ? String(nameEntry.value ?? "") : "",
            hidden: hiddenEntry ? Boolean(hiddenEntry.value) : false,
            region: regionEntry ? String(regionEntry.value ?? "") : "",
            latitude: parseNullableNumber(latitudeEntry?.value),
            longitude: parseNullableNumber(longitudeEntry?.value),
            tags: parseTags(tagsEntry?.value),
          });
        }
      } catch {
        for (const uuid of newUuids) {
          metaMap.set(uuid, {
            customName: "",
            hidden: false,
            region: "",
            latitude: null,
            longitude: null,
            tags: [],
          });
        }
      }

      // 追加新 UUID，等下次 fetchDynamic 自动重建 servers.value
      uuids.push(...newUuids);
    } finally {
      fetchStaticInFlight = false;
    }
  };
}

export function useOverviewData() {
  initFunctions();

  if (!visibilityListenerAttached && typeof document !== "undefined") {
    visibilityListenerAttached = true;
    document.addEventListener("visibilitychange", () => {
      if (refCount <= 0) return;
      if (document.visibilityState === "hidden") {
        inactive.value = true;
      } else {
        _fetchDynamic?.();
      }
    });
  }

  const start = async () => {
    refCount++;
    if (pollTimer) return; // 已在运行，直接共享现有状态

    loading.value = true;
    error.value = null;

    // 初始化：UUID 列表、KV metadata、static 硬件信息各取一次
    await _fetchUuidsAndMeta!();
    await _fetchStatic!();
    await _fetchDynamic!();
    loading.value = false;

    // await 期间 stop() 可能已被调用（用户快速切换路由），此时不启动轮询
    // 也防止另一个 start() 在此期间先完成并设置了 pollTimer（避免重复 interval 泄漏）
    if (refCount <= 0 || pollTimer) return;

    // dynamic 数据持续轮询；static 每 60s 检测新 Agent
    pollTimer = setInterval(_fetchDynamic!, POLL_INTERVAL_MS);
    staticPollTimer = setInterval(
      _fetchStaticPeriodic!,
      STATIC_POLL_INTERVAL_MS,
    );
  };

  const stop = () => {
    refCount--;
    if (refCount > 0) return; // 还有其他组件在使用，不停止

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (staticPollTimer) {
      clearInterval(staticPollTimer);
      staticPollTimer = null;
    }
    if (pollConn) {
      pollConn.close();
      pollConn = null;
    }
  };

  return { servers, loading, error, inactive, start, stop };
}
