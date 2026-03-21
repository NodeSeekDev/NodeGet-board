import { computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";
import { toast } from "vue-sonner";
import {
  type PermissionEntry,
  type Token,
  type TokenDetail,
  type TokenLimitEntry,
  type TokenLimitScope,
  type TokenLimitScopeItem,
} from "../type";

export type errorResponse = {
  error: {
    code: 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 999;
    message: string;
  };
};

const createDefaultToken = (): Token => ({
  version: 1,
  timestamp_from: 0,
  timestamp_to: 0,
  token_limit: [
    {
      scopes: [{ global: null }],
      permissions: [],
    },
  ],
  username: "",
  password: "",
});

const toScopeItemFromString = (value: string): TokenLimitScopeItem => {
  if (value === "global") {
    return { global: null };
  }

  if (value.startsWith("agent_uuid:")) {
    return { AgentUuid: [value.slice("agent_uuid:".length)] };
  }

  if (value.startsWith("kv_namespace:")) {
    return { KvNamespace: [value.slice("kv_namespace:".length)] };
  }

  return { AgentUuid: [value] };
};

const normalizeScopeItem = (item: unknown): TokenLimitScopeItem | null => {
  if (typeof item === "string") {
    const scope = item.trim();
    return scope ? toScopeItemFromString(scope) : null;
  }

  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const source = item as Record<string, unknown>;
  if ("global" in source) return { global: null };

  const agent = source.AgentUuid ?? source.agent_uuid;
  if (Array.isArray(agent)) {
    return {
      AgentUuid: agent.filter(
        (value): value is string => typeof value === "string",
      ),
    };
  }
  if (typeof agent === "string") return { AgentUuid: [agent] };

  const kvNamespace = source.KvNamespace ?? source.kv_namespace;
  if (Array.isArray(kvNamespace)) {
    return {
      KvNamespace: kvNamespace.filter(
        (value): value is string => typeof value === "string",
      ),
    };
  }
  if (typeof kvNamespace === "string") return { KvNamespace: [kvNamespace] };

  return null;
};

const normalizeScopes = (scopes: unknown): TokenLimitScope => {
  if (!Array.isArray(scopes) || scopes.length === 0) return [{ global: null }];
  const normalized = scopes
    .map((item) => normalizeScopeItem(item))
    .filter((item): item is TokenLimitScopeItem => item !== null);
  return normalized.length > 0 ? normalized : [{ global: null }];
};

const normalizePermissions = (permissions: unknown): PermissionEntry[] => {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter(
    (permission): permission is PermissionEntry =>
      !!permission &&
      typeof permission === "object" &&
      !Array.isArray(permission),
  );
};

const normalizeTokenLimit = (tokenLimit: unknown): TokenLimitEntry[] => {
  if (!Array.isArray(tokenLimit) || tokenLimit.length === 0) {
    return createDefaultToken().token_limit;
  }

  const normalized = tokenLimit
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      return {
        scopes: normalizeScopes(source.scopes),
        permissions: normalizePermissions(source.permissions),
      } as TokenLimitEntry;
    })
    .filter((item): item is TokenLimitEntry => item !== null);

  return normalized.length > 0 ? normalized : createDefaultToken().token_limit;
};

const scopeToApiValue = (item: TokenLimitScopeItem): string[] => {
  if ("global" in item) return ["global"];
  if ("AgentUuid" in item) {
    return (item.AgentUuid ?? []).map((value) => `agent_uuid:${value}`);
  }
  if ("KvNamespace" in item) {
    return (item.KvNamespace ?? []).map((value) => `kv_namespace:${value}`);
  }
  return [];
};

export const mapTokenDetailToForm = (detail: TokenDetail | null): Token => {
  if (!detail) return createDefaultToken();

  return {
    version: detail.version ?? 1,
    username: detail.username ?? "",
    password: detail.password ?? "",
    timestamp_from: detail.timestamp_from ?? 0,
    timestamp_to: detail.timestamp_to ?? 0,
    token_limit: normalizeTokenLimit(detail.token_limit),
  };
};

const buildUpdateLimit = (token: Token) => {
  return (token.token_limit ?? []).map((item) => ({
    scopes: (item.scopes ?? []).flatMap(scopeToApiValue),
    permissions: normalizePermissions(item.permissions),
  }));
};

const toNullableTimestamp = (value: number) => (value > 0 ? value : null);

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

    const normalizedLimit = buildUpdateLimit(tokenData);
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
