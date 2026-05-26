import { reactive, type Ref } from "vue";
import { toast } from "vue-sonner";
import { fetchDynamicSummary } from "@/composables/monitoring/useDynamicMonitoring";
import type {
  DynamicSummaryResponseItem,
  SummaryField,
} from "@/types/monitoring";
import type { TabId } from "@/components/node/status/constants";

const DEFAULT_WINDOW_MS = 6 * 60 * 60 * 1000;
const DEFAULT_REFRESH_MS = 10_000;

const TAB_FIELDS_AVG: Record<TabId, SummaryField[][]> = {
  cpu: [
    ["cpu_usage", "process_count"],
    ["load_one", "load_five", "load_fifteen"],
  ],
  memory: [["used_memory", "total_memory"]],
  disk: [["read_speed", "write_speed"]],
  network: [
    ["transmit_speed", "receive_speed"],
    ["tcp_connections", "udp_connections"],
  ],
};

export interface SummarySlice {
  windowMs: number;
  refreshInterval: number;
  data: DynamicSummaryResponseItem[];
  loading: boolean;
  fetchData(showLoading?: boolean): Promise<void>;
  startTimer(): void;
  stopTimer(): void;
  clear(): void;
}

function createSummarySlice(uuid: Ref<string>, tab: TabId): SummarySlice {
  const state = reactive({
    windowMs: DEFAULT_WINDOW_MS,
    refreshInterval: DEFAULT_REFRESH_MS,
    data: [] as DynamicSummaryResponseItem[],
    loading: false,
  });
  let timer: ReturnType<typeof setInterval> | null = null;
  let fetchSeq = 0;

  // Pulls one window slice + merges across summary field groups returned by backend
  async function pull(
    from: number,
    to: number,
  ): Promise<DynamicSummaryResponseItem[]> {
    const groups = await Promise.all(
      TAB_FIELDS_AVG[tab].map((fields) =>
        fetchDynamicSummary(
          uuid.value,
          { timestamp_from: from, timestamp_to: to },
          fields,
        ),
      ),
    );
    const merged = new Map<number, DynamicSummaryResponseItem>();
    for (const g of groups) {
      if (!Array.isArray(g)) continue;
      for (const row of g as DynamicSummaryResponseItem[]) {
        const cur = merged.get(row.timestamp);
        if (cur) Object.assign(cur, row);
        else merged.set(row.timestamp, { ...row });
      }
    }
    return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  // Full replace — used for tab/window/uuid switches; surfaces error via toast
  async function fetchData(showLoading = true) {
    if (!uuid.value) return;
    const seq = ++fetchSeq;
    if (showLoading) state.loading = true;
    const now = Date.now();
    try {
      const result = await pull(now - state.windowMs, now);
      if (seq !== fetchSeq) return;
      state.data = result;
    } catch (e) {
      if (seq !== fetchSeq) return;
      console.error(`[Status] ${tab} summary fetch failed:`, e);
      const description =
        e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
      toast.error("数据查询失败", { description });
    } finally {
      if (showLoading && seq === fetchSeq) state.loading = false;
    }
  }

  // Incremental: pull [lastTs+1, now], merge into state.data, trim points outside window.
  // Falls back to silent full pull when no baseline. Errors stay silent (would otherwise
  // spam toasts at the refresh interval if the backend is briefly unreachable).
  async function tick() {
    if (!uuid.value) return;
    const seq = ++fetchSeq;
    const now = Date.now();

    if (state.data.length === 0) {
      try {
        const result = await pull(now - state.windowMs, now);
        if (seq !== fetchSeq) return;
        state.data = result;
      } catch (e) {
        if (seq !== fetchSeq) return;
        console.error(`[Status] ${tab} tick (full) failed:`, e);
      }
      return;
    }

    const lastTs = state.data[state.data.length - 1]!.timestamp;
    try {
      const incoming = await pull(lastTs + 1, now);
      if (seq !== fetchSeq) return;
      const merged = new Map<number, DynamicSummaryResponseItem>();
      for (const row of state.data) merged.set(row.timestamp, row);
      for (const row of incoming) {
        const cur = merged.get(row.timestamp);
        if (cur) Object.assign(cur, row);
        else merged.set(row.timestamp, row);
      }
      const cutoff = now - state.windowMs;
      state.data = [...merged.values()]
        .filter((r) => r.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (e) {
      if (seq !== fetchSeq) return;
      console.error(`[Status] ${tab} tick (incremental) failed:`, e);
    }
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => tick(), state.refreshInterval);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function clear() {
    state.data = [];
  }

  return Object.assign(state, {
    fetchData,
    startTimer,
    stopTimer,
    clear,
  }) as SummarySlice;
}

export function useTabSummaries(uuid: Ref<string>) {
  const cpu = createSummarySlice(uuid, "cpu");
  const memory = createSummarySlice(uuid, "memory");
  const disk = createSummarySlice(uuid, "disk");
  const network = createSummarySlice(uuid, "network");

  const all: Record<TabId, SummarySlice> = { cpu, memory, disk, network };

  function get(tab: TabId): SummarySlice {
    return all[tab];
  }

  function stopAll() {
    (Object.values(all) as SummarySlice[]).forEach((s) => s.stopTimer());
  }

  function clearAll() {
    (Object.values(all) as SummarySlice[]).forEach((s) => s.clear());
  }

  function clampAll(mapper: (windowMs: number) => number) {
    (Object.values(all) as SummarySlice[]).forEach((s) => {
      s.windowMs = mapper(s.windowMs);
    });
  }

  return { cpu, memory, disk, network, get, stopAll, clearAll, clampAll };
}
