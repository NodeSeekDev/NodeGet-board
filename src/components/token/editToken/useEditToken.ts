import { computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";
import { toast } from "vue-sonner";
import { type Token } from "../type";
import { buildLimitPayload, mapTokenDetailToForm } from "../scopeCodec";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: string;
  };
};

const toNullableTimestamp = (value: number) => (value > 0 ? value : null);

export { mapTokenDetailToForm };

export const useEditTokenHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");

  const updateToken = async (
    tokenData: Token,
    targetToken: string,
  ): Promise<boolean> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = targetToken.trim();
    if (!url || !token || !target_token) return false;

    const normalizedLimit = buildLimitPayload(tokenData);
    const version = tokenData.version ?? 1;
    const username = tokenData.username ?? "";
    const password = tokenData.password ?? "";
    const timestamp_from = toNullableTimestamp(tokenData.timestamp_from);
    const timestamp_to = toNullableTimestamp(tokenData.timestamp_to);
    try {
      const result = await wsRpcCall<{
        success?: string;
        token_key?: string;
        message?: string;
      }>(url, "token_edit", {
        token,
        target_token,
        version,
        username,
        password,
        timestamp_from,
        timestamp_to,
        limit: normalizedLimit,
      });

      if (result?.success || result?.message || result?.token_key) {
        toast.success("更新Token成功");
        return true;
      }

      toast.error("更新Token失败");
      return false;
    } catch (error) {
      console.error(error);
      toast.error("更新Token失败");
      return false;
    }
  };

  return { updateToken };
};
