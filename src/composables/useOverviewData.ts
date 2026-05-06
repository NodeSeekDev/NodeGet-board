import { ref, watch, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import type { NodeMetadata } from "@/types/agent";
import { OFFLINE_AFTER_MS } from "@/utils/show";
import { currentAgentInfo } from "@/composables/useAgentInfo";
import { useStaticMonitoring } from "@/composables/monitoring/useStaticMonitoring";
import { useDynamicSummaryMultiLast } from "@/composables/monitoring/useDynamicMonitoring";

const POLL_INTERVAL_MS = 1000;
const STATIC_POLL_INTERVAL_MS = 60_000;

// ============ Types ============

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
  order: number;
}

// ============ State Management ============

const { currentBackend } = useBackendStore();

const servers = ref<OverviewServer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const inactive = ref(false);

// Polling lifecycle management
let pollTimer: ReturnType<typeof setInterval> | null = null;
let staticPollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerAttached = false;
let refCount = 0;
let lastFetchTime = 0;

// ============ Helper Functions ============

/**
 * 获取默认的元数据对象
 */
function getDefaultMetadata() {
  return {
    customName: "",
    hidden: false,
    region: "",
    latitude: null as number | null,
    longitude: null as number | null,
    tags: [],
    order: 0,
  };
}

/**
 * 从多个数据源合并构建完整的服务器概览
 */
function buildOverviewServers(
  dynamicData: any[],
  staticData: any[],
  metadata: Map<string, NodeMetadata>,
  uuids: string[],
): OverviewServer[] {
  const dynamicMap = new Map(dynamicData.map((d) => [d.uuid, d]));
  const staticMap = new Map(staticData.map((s) => [s.uuid, s]));

  return uuids.map((uuid) => {
    const d = dynamicMap.get(uuid) ?? { uuid };
    const s = staticMap.get(uuid) ?? { uuid };
    const meta = metadata.get(uuid) ?? getDefaultMetadata();

    return {
      uuid,
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
      system: s.system as Record<string, unknown> | undefined,
      gpu: (s.gpu ?? []) as unknown[],
      customName: meta.customName,
      hidden: meta.hidden,
      region: meta.region,
      latitude: meta.latitude,
      longitude: meta.longitude,
      tags: meta.tags,
      order: meta.order,
    };
  });
}

/**
 * 附加可见性变化监听器
 */
function attachVisibilityListener(onVisible: () => void) {
  if (visibilityListenerAttached || typeof document === "undefined") {
    return;
  }

  visibilityListenerAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (refCount <= 0) return;

    if (document.visibilityState === "hidden") {
      inactive.value = true;
    } else {
      inactive.value = false;
      onVisible();
    }
  });
}

/**
 * 启动轮询
 */
function startPolling(
  onDynamicFetch: () => Promise<void>,
  onStaticFetch: () => Promise<void>,
) {
  if (pollTimer) return; // 已在轮询

  pollTimer = setInterval(() => void onDynamicFetch(), POLL_INTERVAL_MS);
  staticPollTimer = setInterval(
    () => void onStaticFetch(),
    STATIC_POLL_INTERVAL_MS,
  );
}

/**
 * 停止轮询
 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (staticPollTimer) {
    clearInterval(staticPollTimer);
    staticPollTimer = null;
  }
}

// ============ Main Composable ============

export function useOverviewData() {
  // Initialize monitoring composables
  const staticMonitoring = useStaticMonitoring(currentBackend);
  const dynamicMonitoring = useDynamicSummaryMultiLast(currentBackend);

  // Build metadata map from agent info
  const metadataMap = computed(() => {
    return new Map(
      currentAgentInfo.agents.value
        .filter((v) => !!v.metadata)
        .map((v) => [v.uuid, v.metadata as NodeMetadata]),
    );
  });

  // Get current UUID list
  const uuids = computed(() =>
    currentAgentInfo.agents.value.map((v) => v.uuid),
  );

  // Watch backend changes
  watch(
    () => currentBackend.value,
    async () => {
      await currentAgentInfo.fetchAgents();
    },
    { deep: true, immediate: true },
  );

  /**
   * Fetch all data once (for initial load and refresh)
   */
  const fetchAll = async () => {
    try {
      loading.value = true;
      error.value = null;

      // Fetch agents and metadata
      await currentAgentInfo.fetchAgents();

      if (uuids.value.length === 0) {
        servers.value = [];
        return;
      }

      // Parallel fetch static and dynamic data
      await Promise.all([
        staticMonitoring.refresh(uuids.value),
        dynamicMonitoring.refresh(uuids.value),
      ]);

      lastFetchTime = Date.now();

      // Merge all data sources
      servers.value = buildOverviewServers(
        dynamicMonitoring.servers.value,
        staticMonitoring.servers.value,
        metadataMap.value,
        uuids.value,
      );

      // Check for errors from monitoring services
      if (staticMonitoring.error.value) {
        error.value = staticMonitoring.error.value;
      } else if (dynamicMonitoring.error.value) {
        error.value = dynamicMonitoring.error.value;
      }
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch only dynamic data (for polling)
   */
  const fetchDynamic = async () => {
    if (uuids.value.length === 0) return;

    try {
      const startedVisible =
        typeof document === "undefined" ||
        document.visibilityState === "visible";

      await dynamicMonitoring.refresh(uuids.value);
      lastFetchTime = Date.now();

      if (
        startedVisible &&
        (typeof document === "undefined" ||
          document.visibilityState === "visible")
      ) {
        inactive.value = false;
      }

      // Merge data
      servers.value = buildOverviewServers(
        dynamicMonitoring.servers.value,
        staticMonitoring.servers.value,
        metadataMap.value,
        uuids.value,
      );

      if (error.value && !dynamicMonitoring.error.value) {
        error.value = null;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  };

  /**
   * Fetch new agents data (for periodic static discovery)
   */
  const fetchNewAgents = async () => {
    try {
      await currentAgentInfo.fetchAgents();

      const newUuids = currentAgentInfo.agents.value
        .map((v) => v.uuid)
        .filter((u) => !uuids.value.includes(u));

      if (newUuids.length > 0) {
        await Promise.all([
          staticMonitoring.refresh(newUuids),
          dynamicMonitoring.refresh(),
        ]);

        servers.value = buildOverviewServers(
          dynamicMonitoring.servers.value,
          staticMonitoring.servers.value,
          metadataMap.value,
          uuids.value,
        );
      }
    } catch {
      // Continue on error
    }
  };

  // Attach visibility listener
  attachVisibilityListener(() => void fetchDynamic());

  // Check offline state
  if (lastFetchTime && Date.now() - lastFetchTime >= OFFLINE_AFTER_MS) {
    servers.value = [];
  }

  /**
   * Public refresh function
   */
  const refresh = async () => {
    await fetchAll();
  };

  /**
   * Start monitoring with polling
   */
  const start = async () => {
    refCount++;
    if (pollTimer) return; // Already running

    await fetchAll();

    // Safety check: refCount might have changed during await
    if (refCount <= 0 || pollTimer) return;

    startPolling(
      () => fetchDynamic(),
      () => fetchNewAgents(),
    );
  };

  /**
   * Stop monitoring and polling
   */
  const stop = () => {
    refCount--;
    if (refCount > 0) return; // Other components still using it

    stopPolling();
  };

  return { servers, loading, error, inactive, start, stop, refresh };
}
