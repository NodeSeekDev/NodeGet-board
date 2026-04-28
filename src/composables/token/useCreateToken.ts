import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { toast } from "vue-sonner";
import { type token } from "@/components/token/type";
import { serializeTokenPayload } from "@/components/token/scopeCodec";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: String;
  };
};

export const useCreatTokenHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const { t } = useI18n();

  //   获取agent-uuid列表
  const createToken = async (
    token_creation: token,
  ): Promise<{ key?: string; secret?: string }> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    if (!url || !token) return {};
    const normalizedTokenCreation = serializeTokenPayload(token_creation);
    try {
      const result = await getWsConnection(url).call<{
        key?: string;
        secret?: string;
      }>("token_create", {
        father_token: token,
        token_creation: normalizedTokenCreation,
      });
      if (result.key && result.secret) {
        toast.success(t("dashboard.token.api.createSuccess"));
        return result;
      }
      toast.error(t("dashboard.token.api.createFailed"));
      return {};
    } catch (error) {
      toast.error(t("dashboard.token.api.createFailed"));
      return {};
    }
  };

  return { createToken };
};
