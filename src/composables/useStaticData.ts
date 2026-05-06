import { ref, watch } from "vue";
import { useBackendStore } from "./useBackendStore";
import { getWsConnection } from "./useWsConnection";
import type { StaticResponseItem } from "@/types/monitoring";

export function useStaticData(backend = useBackendStore().currentBackend) {
  const staticStatus = ref<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const staticError = ref("");
  const staticServers = ref<StaticResponseItem[]>([]);

  const queryFields = ["cpu", "system", "gpu"];

  const fetchStatic = async () => {
    if (!backend.value?.url || !backend.value?.token) {
      staticError.value = "Invalid backend configuration.";
      staticStatus.value = "disconnected";
      return;
    }

    staticStatus.value = "connecting";
    staticError.value = "";

    try {
      const result = await getWsConnection(backend.value.url).call<
        StaticResponseItem[]
      >("agent_query_static", [
        backend.value.token,
        { fields: queryFields, condition: [{ last: null }] },
      ]);
      if (Array.isArray(result)) {
        staticServers.value = result;
        staticStatus.value = "connected";
      } else {
        staticStatus.value = "disconnected";
      }
    } catch (e) {
      console.error("[Static] fetch failed:", e);
      staticError.value = e instanceof Error ? e.message : String(e);
      staticStatus.value = "disconnected";
    }
  };

  watch(
    backend,
    (newVal, oldVal) => {
      if (newVal?.url === oldVal?.url && newVal?.token === oldVal?.token)
        return;
      staticServers.value = [];
      staticStatus.value = "disconnected";
      if (newVal) void fetchStatic();
    },
    { deep: true },
  );
  return {
    status: staticStatus,
    error: staticError,
    servers: staticServers,
    connect: fetchStatic,
    refresh: fetchStatic,
  };
}
