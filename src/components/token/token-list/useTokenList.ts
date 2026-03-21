import { computed, onMounted, ref, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";
import { toast } from "vue-sonner";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: String;
  };
};

export type TokenLimit = {
  scopes: Array<string | Record<string, string>>;
  permissions: Array<Record<string, unknown>>;
};

export type Token = {
  version: number;
  token_key: string;
  timestamp_from: null | number;
  timestamp_to: null | number;
  token_limit: TokenLimit[];
  username: string;
};
export const useTokenListHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");

  //   获取token列表
  const getTokenList = async (): Promise<Token[]> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    if (!url || !token) return [];
    try {
      const result = await wsRpcCall<{ tokens?: Token[] }>(
        url,
        "token_list_all_tokens",
        {
          token,
        },
      );
      if (Array.isArray(result?.tokens) && result.tokens.length > 0) {
        return result.tokens;
      }
      toast.error("获取token列表失败");
      return [];
    } catch (error) {
      console.error(error);
      toast.error("获取token列表失败");
      return [];
    }
  };

  //   删除Token
  const deleteToken = async (tokenItem: Token) => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = tokenItem.token_key ?? tokenItem.username;
    if (!url || !token) return;
    try {
      const result = await wsRpcCall<{ message: string }>(url, "token_delete", {
        token,
        target_token,
      });
      if (result?.message) {
        toast.success("删除成功");
        getTokenList();
      } else {
        toast.error("删除失败");
      }
    } catch (error) {
      console.error(error);
    }
  };

  watch(currentBackend, () => {
    getTokenList();
  });

  return { getTokenList, deleteToken };
};
