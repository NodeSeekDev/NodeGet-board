import { computed, ref } from "vue";
import { useKv } from "@/composables/useKv";
import {
  DEFAULT_DYNAMIC_LIMIT,
  DEFAULT_SUMMARY_LIMIT,
  WINDOWS,
} from "@/components/node/status/constants";

export function useDatabaseLimits() {
  const kv = useKv();
  const dynamicLimit = ref(DEFAULT_DYNAMIC_LIMIT);
  const summaryLimit = ref(DEFAULT_SUMMARY_LIMIT);

  async function fetch(uuid: string) {
    if (!uuid) return;
    try {
      kv.namespace.value = uuid;
      const [dyn, sum] = await Promise.all([
        kv.getValue("database_limit_dynamic_monitoring"),
        kv.getValue("database_limit_dynamic_monitoring_summary"),
      ]);
      dynamicLimit.value =
        typeof dyn === "number" && dyn > 0 ? dyn : DEFAULT_DYNAMIC_LIMIT;
      summaryLimit.value =
        typeof sum === "number" && sum > 0 ? sum : DEFAULT_SUMMARY_LIMIT;
    } catch (e) {
      console.error("[Status] Failed to fetch database limits:", e);
    }
  }

  const summaryWindows = computed(() =>
    WINDOWS.filter((w) => w.value <= summaryLimit.value),
  );
  const detailWindows = computed(() =>
    WINDOWS.filter((w) => w.value <= dynamicLimit.value),
  );

  // Find largest WINDOWS entry not exceeding `max`; fallback to smallest
  const clampWindow = (current: number, max: number) => {
    if (current <= max) return current;
    const best = [...WINDOWS].reverse().find((w) => w.value <= max);
    return best?.value ?? WINDOWS[WINDOWS.length - 1]!.value;
  };

  return {
    dynamicLimit,
    summaryLimit,
    fetch,
    summaryWindows,
    detailWindows,
    clampWindow,
  };
}
