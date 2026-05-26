import { ref, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { getAgentInfoFromPool } from "@/composables/useAgentInfo";
import { useInFlightDedupe } from "@/composables/useInFlightDedupe";
import type { FullDynamicSummaryResponseItem } from "@/types/monitoring";
import { DYNAMIC_SUMMARY_FIELDS } from "@/types/monitoring";
import { OFFLINE_AFTER_MS } from "@/utils/show";

type FullDynamicSummaryResponseItemWithOnline =
  FullDynamicSummaryResponseItem & {
    online: boolean;
  };

/*
  获取所有节点的最新动态摘要
*/
export function useDynamicSummaryMultiLast(
  backend = useBackendStore().currentBackend,
) {
  const status = ref<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const error = ref("");
  const servers = ref<FullDynamicSummaryResponseItemWithOnline[]>([]);
  const queryFields = DYNAMIC_SUMMARY_FIELDS;
  const agentInfo = getAgentInfoFromPool(backend);
  const { fetchAgents, agents } = agentInfo;

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

      if (status.value === "disconnected") {
        status.value = "connecting";
      }
      error.value = "";
      const result = await getWsConnection(backend.value.url).call<
        FullDynamicSummaryResponseItem[]
      >("agent_dynamic_summary_multi_last_query", {
        token: backend.value.token,
        uuids: uuids,
        fields: queryFields,
      });
      const clientTime = Date.now();
      if (Array.isArray(result)) {
        servers.value = result.map((v) => ({
          ...v,
          online: clientTime - v.timestamp < OFFLINE_AFTER_MS,
        }));
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
