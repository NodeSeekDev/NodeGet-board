import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { useAgentStatus } from "@/composables/useAgentStatus";
import { useStaticMonitoring } from "@/composables/monitoring/useStaticMonitoring";
import {
  type DetailTab,
  type TabId,
  effectiveDetailRefresh,
} from "@/components/node/status/constants";
import { useDatabaseLimits } from "@/components/node/status/composables/useDatabaseLimits";
import { useTabSummaries } from "@/components/node/status/composables/useTabSummaries";
import { useTabDetails } from "@/components/node/status/composables/useTabDetails";
import { useLiveLabel } from "@/components/node/status/composables/useLiveLabel";

type ZoomRange = { min: number; max: number } | null;

export function useStatusPage(uuid: Ref<string>) {
  const {
    error: dynamicError,
    status: dynamicStatus,
    servers: dynamicServers,
  } = useAgentStatus();

  const { servers: staticServers, refresh: connectStatic } =
    useStaticMonitoring();

  const limits = useDatabaseLimits();
  const summaries = useTabSummaries(uuid);
  const details = useTabDetails(uuid);

  const activeTab = ref<TabId>("cpu");

  const selectedDisk = ref("");
  const selectedIface = ref("all");

  const cpuSyncAxes = ref(true);
  const netSyncAxes = ref(true);
  const cpuZoom = ref<ZoomRange>(null);
  const netZoom = ref<ZoomRange>(null);

  // Reset zoom whenever sync axes is toggled off
  watch(cpuSyncAxes, (v) => {
    if (!v) cpuZoom.value = null;
  });
  watch(netSyncAxes, (v) => {
    if (!v) netZoom.value = null;
  });

  const server = computed(() => {
    const dServer = dynamicServers.value.find((s) => s.uuid === uuid.value);
    const sServer = staticServers.value.find((s) => s.uuid === uuid.value);

    if (dServer) {
      return {
        ...dServer,
        system: sServer?.system,
        cpu_static: sServer?.cpu,
        gpu: sServer?.gpu || [],
      };
    }
    return undefined;
  });

  const notFound = computed(
    () =>
      dynamicStatus.value === "connected" &&
      dynamicServers.value.length > 0 &&
      !dynamicServers.value.find((s) => s.uuid === uuid.value),
  );

  const live = useLiveLabel(server);

  // Auto-select first disk once we have data (disk tab only)
  watch(
    () => details.disk.data,
    (data) => {
      if (selectedDisk.value || data.length === 0) return;
      const last = data[data.length - 1];
      if (last?.disk?.length) {
        selectedDisk.value = last.disk[0]?.name ?? "";
      }
    },
  );

  function startDetailTimer(tab: DetailTab) {
    const slice = details[tab];
    const interval = effectiveDetailRefresh(
      slice.windowMs,
      slice.refreshInterval,
    );
    slice.startTimer(interval);
  }

  function startActiveDetail(tab: TabId) {
    if (tab === "cpu") {
      details.cpu.fetchData();
      details.cpu.startTimer();
    } else if (tab === "disk" || tab === "network") {
      details[tab].fetchData();
      startDetailTimer(tab);
    }
    // memory tab: no detail fetch
  }

  function stopActiveDetail(tab: TabId) {
    if (tab === "cpu") {
      details.cpu.stopTimer();
    } else if (tab === "disk" || tab === "network") {
      details[tab].stopTimer();
    }
  }

  // Connection lifecycle: when connected, kick off active tab; otherwise stop
  watch(
    dynamicStatus,
    (status) => {
      if (status === "connected") {
        const tab = activeTab.value;
        summaries.get(tab).fetchData();
        summaries.get(tab).startTimer();
        startActiveDetail(tab);
      } else {
        summaries.stopAll();
        details.stopAll();
      }
    },
    { immediate: true },
  );

  // Tab switch: stop old, start new (if connected)
  watch(activeTab, (newTab, oldTab) => {
    if (oldTab) {
      summaries.get(oldTab).stopTimer();
      stopActiveDetail(oldTab);
    }
    if (dynamicStatus.value === "connected") {
      summaries.get(newTab).fetchData();
      summaries.get(newTab).startTimer();
      startActiveDetail(newTab);
    }
  });

  // Node switch: clear all detail state & re-fetch limits
  watch(uuid, () => {
    details.clearAll();
    selectedDisk.value = "";
    selectedIface.value = "all";
    summaries.stopAll();
    details.stopAll();
    summaries.clearAll();
    limits.fetch(uuid.value);
  });

  // Clamp windowMs when limits change
  watch([limits.summaryLimit, limits.dynamicLimit], () => {
    summaries.clampAll((w) => limits.clampWindow(w, limits.summaryLimit.value));
    details.clampDetail((w) =>
      limits.clampWindow(w, limits.dynamicLimit.value),
    );
  });

  onMounted(() => {
    connectStatic();
    limits.fetch(uuid.value);
  });

  onUnmounted(() => {
    summaries.stopAll();
    details.stopAll();
  });

  return {
    // page state
    server,
    notFound,
    dynamicError,

    // active tab
    activeTab,

    // limits / window options
    summaryWindows: limits.summaryWindows,
    detailWindows: limits.detailWindows,

    // per-tab data
    summaries,
    details,

    // detail UI selection
    selectedDisk,
    selectedIface,

    // sync axes
    cpuSyncAxes,
    cpuZoom,
    netSyncAxes,
    netZoom,

    // live indicator
    live,
  };
}
