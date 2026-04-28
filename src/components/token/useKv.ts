import { computed, onMounted, ref, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { toast } from "vue-sonner";
import { type UuidList } from "./type";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: String;
  };
};

export const useKvHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");

  //   获取Kv列表
  const getKvList = async (): Promise<string[]> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    if (!url || !token) return [];
    try {
      const result = await getWsConnection(url).call<string[]>(
        "kv_list_all_namespace",
        { token },
      );
      if (result.length > 0) {
        return result;
      }
      toast.error("获取Kv列表失败");
      return [];
    } catch (error) {
      console.error(error);
      toast.error("获取Kv列表失败");
      return [];
    }
  };

  return { getKvList };
};
