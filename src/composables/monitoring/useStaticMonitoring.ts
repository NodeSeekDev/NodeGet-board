import { ref, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import type { StaticResponseItem } from "@/types/monitoring";
import { getAgentInfoFromPool } from "@/composables/useAgentInfo";
import { Deferred } from "@/lib/Defered";

/*
获取节点的最新静态数据
*/

export function useStaticMonitoring(
  backend = useBackendStore().currentBackend,
) {
  const status = ref<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const error = ref("");
  const servers = ref<StaticResponseItem[]>([]);
  const queryFields = ["cpu", "system", "gpu"];
  const { agents } = getAgentInfoFromPool(backend);
  const loading = ref(false);
  let deferred: null | Deferred = null;

  async function refresh(uuids: string[] = []) {
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
      loading.value = true;
      deferred = new Deferred();

      status.value = "connecting";
      error.value = "";
      const result = await getWsConnection(backend.value.url).call<
        StaticResponseItem[]
      >("agent_static_data_multi_last_query", {
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
      loading.value = false;
      if (deferred !== null) {
        deferred.resolve();
        deferred = null;
      }
    }
  }

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
    status,
    error,
    servers,
    refresh,
  };
}
