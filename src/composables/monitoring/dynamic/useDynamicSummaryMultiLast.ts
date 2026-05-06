import { ref, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useAgentInfo } from "@/composables/useAgentInfo";
import { useInFlightDedupe } from "@/composables/useInFlightDedupe";
import type { FullDynamicMonitoringSummaryData } from "@/types/monitoring";
import { DYNAMIC_SUMMARY_FIELDS } from "@/types/monitoring";

/*
获取节点的动态数据，包括

- 所有节点的最新动态摘要

- 某个节点的动态摘要历史
- 某个节点的动态数据历史
- 某个节点的最新动态数据
*/

export function useDynamicSummaryMultiLast(
  backend = useBackendStore().currentBackend,
) {
  const status = ref<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const error = ref("");
  const servers = ref<FullDynamicMonitoringSummaryData[]>([]);
  const queryFields = DYNAMIC_SUMMARY_FIELDS;
  const { fetchAgents, agents } = useAgentInfo(backend);

  async function _refresh(uuids: string[] = []) {
    try {
      if (uuids.length === 0) {
        if (agents.value.length === 0) {
          return;
        }
        uuids = agents.value.map((v) => v.uuid);
      }
      if (!backend.value?.url || !backend.value?.token) {
        error.value = "Invalid backend configuration.";
        status.value = "disconnected";
        return;
      }

      status.value = "connecting";
      error.value = "";
      const result = await getWsConnection(backend.value.url).call<
        FullDynamicMonitoringSummaryData[]
      >("agent_dynamic_summary_multi_last_query", {
        token: backend.value.token,
        uuids: uuids,
        fields: queryFields,
      });
      if (Array.isArray(result)) {
        servers.value = result;
        status.value = "connected";
      } else {
        status.value = "disconnected";
      }
    } catch (e) {
      console.error("[Static] fetch failed:", e);
      error.value = e instanceof Error ? e.message : String(e);
      status.value = "disconnected";
    } finally {
    }
  }

  const { execute: refresh, isLoading: loading } = useInFlightDedupe(_refresh);

  watch(
    backend,
    (newVal, oldVal) => {
      if (newVal?.url === oldVal?.url && newVal?.token === oldVal?.token)
        return;
      servers.value = [];
      status.value = "disconnected";
      if (newVal) void refresh();
    },
    { deep: true },
  );
  return {
    loading,
    status,
    error,
    servers,
    refresh,
  };
}
