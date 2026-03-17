import { ref } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useKv } from "@/composables/useKv";

const DYNAMIC_FIELDS = ["cpu", "ram", "load", "system", "disk", "network"];
const STATIC_FIELDS = ["cpu", "system", "gpu"];
const POLL_INTERVAL_MS = 1000;
const STATIC_POLL_INTERVAL_MS = 60_000;

type AgentRow = { uuid: string; [key: string]: unknown };

export interface OverviewServer {
  uuid: string;
  cpu?: Record<string, unknown>;
  system?: Record<string, unknown>;
  gpu?: unknown[];
  load?: Record<string, unknown>;
  ram?: Record<string, unknown>;
  disk?: unknown[];
  network?: Record<string, unknown>;
  customName: string;
  hidden: boolean;
}

// --- 模块级单例状态，所有组件共享 ---
const servers = ref<OverviewServer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let staticPollTimer: ReturnType<typeof setInterval> | null = null;
let uuids: string[] = [];
let metaMap = new Map<string, { customName: string; hidden: boolean }>();
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
      ]);
      const results = await kv.getMultiValue(namespaceKeys);
      metaMap = new Map();
      for (const uuid of uuids) {
        const nameEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_name",
        );
        const hiddenEntry = results.find(
          (r) => r.namespace === uuid && r.key === "metadata_hidden",
        );
        metaMap.set(uuid, {
          customName: nameEntry ? String(nameEntry.value ?? "") : "",
          hidden: hiddenEntry ? Boolean(hiddenEntry.value) : false,
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
      const results = await conn().call<AgentRow[]>(
        "agent_dynamic_data_multi_last_query",
        { token: currentBackend.value.token, uuids, fields: DYNAMIC_FIELDS },
      );

      const dynamicMap = new Map<string, AgentRow>();
      for (const d of Array.isArray(results) ? results : []) {
        dynamicMap.set(d.uuid, d);
      }

      servers.value = uuids.map((uuid) => {
        const d = dynamicMap.get(uuid) ?? { uuid };
        const s = staticMap.get(uuid) ?? { uuid };
        const meta = metaMap.get(uuid) ?? { customName: "", hidden: false };

        return {
          uuid,
          cpu: {
            ...(s.cpu as Record<string, unknown> | undefined),
            ...(d.cpu as Record<string, unknown> | undefined),
          },
          system: {
            ...(s.system as Record<string, unknown> | undefined),
            ...(d.system as Record<string, unknown> | undefined),
          },
          gpu: (s.gpu ?? []) as unknown[],
          load: d.load as Record<string, unknown> | undefined,
          ram: d.ram as Record<string, unknown> | undefined,
          disk: d.disk as unknown[] | undefined,
          network: d.network as Record<string, unknown> | undefined,
          customName: meta.customName,
          hidden: meta.hidden,
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
        ]);
        const kvResults = await kv.getMultiValue(namespaceKeys);
        for (const uuid of newUuids) {
          const nameEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_name",
          );
          const hiddenEntry = kvResults.find(
            (r) => r.namespace === uuid && r.key === "metadata_hidden",
          );
          metaMap.set(uuid, {
            customName: nameEntry ? String(nameEntry.value ?? "") : "",
            hidden: hiddenEntry ? Boolean(hiddenEntry.value) : false,
          });
        }
      } catch {
        for (const uuid of newUuids) {
          metaMap.set(uuid, { customName: "", hidden: false });
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
  };

  return { servers, loading, error, start, stop };
}
