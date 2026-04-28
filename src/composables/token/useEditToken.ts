import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { toast } from "vue-sonner";
import { type Token } from "@/components/token/type";
import {
  buildOptionalFieldPayload,
  mapTokenDetailToForm,
  serializeTokenPayload,
} from "@/components/token/scopeCodec";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: string;
  };
};

export { mapTokenDetailToForm };

export const useEditTokenHook = () => {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const { t } = useI18n();

  const updateToken = async (
    tokenData: Token,
    targetToken: string,
  ): Promise<boolean> => {
    const url = backendUrl.value.trim();
    const token = currentBackend.value?.token?.trim() || "";
    const target_token = targetToken.trim();
    if (!url || !token || !target_token) return false;

    const serializedToken = serializeTokenPayload(tokenData);
    try {
      const result = await getWsConnection(url).call<{
        success?: string;
        token_key?: string;
        message?: string;
      }>("token_edit", {
        token,
        target_token,
        version: serializedToken.version,
        limit: serializedToken.token_limit,
        ...buildOptionalFieldPayload(tokenData),
      });

      if (result?.success || result?.message || result?.token_key) {
        toast.success(t("dashboard.token.api.updateSuccess"));
        return true;
      }

      toast.error(t("dashboard.token.api.updateFailed"));
      return false;
    } catch (error) {
      console.error(error);
      toast.error(t("dashboard.token.api.updateFailed"));
      return false;
    }
  };

  return { updateToken };
};
