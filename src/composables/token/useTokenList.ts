import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";
import { toast } from "vue-sonner";
import { type TokenDetail } from "@/components/token/type";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: string;
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
  username: string | null;
};

export const useTokenListHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const { t } = useI18n();

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
      toast.error(t("dashboard.token.api.listFailed"));
      return [];
    } catch (error) {
      console.error(error);
      toast.error(t("dashboard.token.api.listFailed"));
      return [];
    }
  };

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
        toast.success(t("dashboard.token.api.deleteSuccess"));
        getTokenList();
      } else {
        toast.error(t("dashboard.token.api.deleteFailed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("dashboard.token.api.deleteFailed"));
    }
  };

  const getTokenDetailApi = async (
    searchToken: string,
  ): Promise<TokenDetail | null> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = searchToken?.trim() || "";
    if (!url || !token || !target_token) return null;

    try {
      const result = await wsRpcCall<TokenDetail>(url, "token_get", {
        supertoken: token,
        token: target_token,
      });
      if (result?.token_key) {
        return result;
      }
      toast.error(t("dashboard.token.api.detailFailed"));
      return null;
    } catch (error) {
      console.error(error);
      toast.error(t("dashboard.token.api.detailFailed"));
      return null;
    }
  };

  watch(currentBackend, () => {
    getTokenList();
  });

  return { getTokenList, deleteToken, getTokenDetailApi };
};
