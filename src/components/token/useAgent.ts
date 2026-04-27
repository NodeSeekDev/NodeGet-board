import { computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { toast } from "vue-sonner";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: String;
  };
};

export type AgentOption = {
  uuid: string;
  customName: string;
};

export const useAgentHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");

  //   获取agent-uuid列表
  const getAgentList = async (): Promise<string[]> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    if (!url || !token) return [];
    try {
      const result = await getWsConnection(url).call<{ uuids?: string[] }>(
        "nodeget-server_list_all_agent_uuid",
        { token },
      );
      if (Array.isArray(result.uuids) && result.uuids.length > 0) {
        return result.uuids;
      }
      toast.error("获取agent-uuid列表失败");
      return [];
    } catch (error) {
      console.error(error);
      toast.error("获取agent-uuid列表失败");
      return [];
    }
  };

  const getAgentOptions = async (): Promise<AgentOption[]> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    if (!url || !token) return [];

    try {
      const conn = getWsConnection(url);
      const result = await conn.call<{ uuids?: string[] }>(
        "nodeget-server_list_all_agent_uuid",
        {
          token,
        },
      );

      const uuids = Array.isArray(result?.uuids) ? result.uuids : [];
      const nameMap = new Map<string, string>();

      if (uuids.length > 0) {
        try {
          const metadataEntries = await conn.call<
            { namespace: string; key: string; value: unknown }[]
          >("kv_get_multi_value", {
            token,
            namespace_key: uuids.map((uuid) => ({
              namespace: uuid,
              key: "metadata_name",
            })),
          });

          for (const entry of metadataEntries ?? []) {
            if (
              entry?.key === "metadata_name" &&
              entry.namespace &&
              entry.value &&
              !nameMap.has(entry.namespace)
            ) {
              nameMap.set(entry.namespace, String(entry.value));
            }
          }
        } catch {
          // Fall back to UUID-only labels when metadata lookup fails.
        }
      }

      return uuids.map((uuid) => ({
        uuid,
        customName: nameMap.get(uuid) ?? "",
      }));
    } catch (error) {
      console.error(error);
      toast.error("获取agent列表失败");
      return [];
    }
  };

  return { getAgentList, getAgentOptions };
};
