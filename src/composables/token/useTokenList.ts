import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { toast } from "vue-sonner";
import { type TokenDetail } from "@/components/token/type";
import {
  getPasswordChangeValidationError,
  normalizeRollTargetToken,
} from "@/composables/token/tokenSecret";

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

const getTokenErrorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const source = error as {
      message?: unknown;
      error?: {
        message?: unknown;
      };
    };

    if (typeof source.error?.message === "string" && source.error.message) {
      return source.error.message;
    }

    if (typeof source.message === "string" && source.message) {
      return source.message;
    }
  }

  return "";
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
      const result = await getWsConnection(url).call<{ tokens?: Token[] }>(
        "token_list_all_tokens",
        { token },
      );
      if (Array.isArray(result?.tokens)) {
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
      const result = await getWsConnection(url).call<{ message: string }>(
        "token_delete",
        { token, target_token },
      );
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

  const rollTokenSecret = async (
    targetTokenValue: string,
  ): Promise<{ key?: string; secret?: string }> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = normalizeRollTargetToken(targetTokenValue);
    if (!url || !token || !target_token) return {};

    try {
      const result = await getWsConnection(url).call<{
        key?: string;
        secret?: string;
        message?: string;
        error?: {
          message?: string;
        };
      }>("token_roll_token_secret", {
        token,
        target_token,
      });

      if (result.key && result.secret) {
        toast.success(t("dashboard.token.api.rollSecretSuccess"));
        return result;
      }

      const message = result?.error?.message || result?.message || "";
      toast.error(
        message
          ? t("dashboard.token.api.rollSecretFailedWithMessage", { message })
          : t("dashboard.token.api.rollSecretFailed"),
      );
      return {};
    } catch (error) {
      console.error(error);
      const message = getTokenErrorMessage(error);
      toast.error(
        message
          ? t("dashboard.token.api.rollSecretFailedWithMessage", { message })
          : t("dashboard.token.api.rollSecretFailed"),
      );
      return {};
    }
  };

  const changeTokenPassword = async (
    targetTokenValue: string,
    newPassword: string,
  ): Promise<boolean> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = normalizeRollTargetToken(targetTokenValue);
    if (
      !url ||
      !token ||
      !target_token ||
      getPasswordChangeValidationError(newPassword, newPassword)
    ) {
      return false;
    }

    try {
      const result = await getWsConnection(url).call<{
        success?: boolean;
        message?: string;
        error?: {
          message?: string;
        };
      }>("token_change_password", {
        token,
        target_token,
        new_password: newPassword,
      });

      if (result?.success) {
        toast.success(t("dashboard.token.api.changePasswordSuccess"));
        return true;
      }

      const message = result?.error?.message || result?.message || "";
      toast.error(
        message
          ? t("dashboard.token.api.changePasswordFailedWithMessage", {
              message,
            })
          : t("dashboard.token.api.changePasswordFailed"),
      );
      return false;
    } catch (error) {
      console.error(error);
      const message = getTokenErrorMessage(error);
      toast.error(
        message
          ? t("dashboard.token.api.changePasswordFailedWithMessage", {
              message,
            })
          : t("dashboard.token.api.changePasswordFailed"),
      );
      return false;
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
      const result = await getWsConnection(url).call<TokenDetail>("token_get", {
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

  return {
    getTokenList,
    deleteToken,
    getTokenDetailApi,
    rollTokenSecret,
    changeTokenPassword,
  };
};
