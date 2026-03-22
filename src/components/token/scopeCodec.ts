import type {
  PermissionEntry,
  Token,
  TokenDetail,
  TokenLimitEntry,
  TokenLimitScope,
  TokenLimitScopeItem,
} from "./type.js";

export const DEFAULT_SCOPE: TokenLimitScope = [{ global: null }];

export const createDefaultToken = (): Token => ({
  version: 1,
  timestamp_from: 0,
  timestamp_to: 0,
  token_limit: [
    {
      scopes: DEFAULT_SCOPE,
      permissions: [],
    },
  ],
  username: "",
  password: "",
});

const normalizeStringList = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toScopeItemFromString = (value: string): TokenLimitScopeItem => {
  if (value === "global") {
    return { global: null };
  }

  if (value.startsWith("agent_uuid:")) {
    return { agent_uuid: value.slice("agent_uuid:".length) };
  }

  if (value.startsWith("kv_namespace:")) {
    return { kv_namespace: value.slice("kv_namespace:".length) };
  }

  return { agent_uuid: value };
};

export const normalizeScopeItem = (item: unknown): TokenLimitScopeItem[] => {
  if (typeof item === "string") {
    const scope = item.trim();
    return scope ? [toScopeItemFromString(scope)] : [];
  }

  if (!item || typeof item !== "object" || Array.isArray(item)) return [];

  const source = item as Record<string, unknown>;
  if ("global" in source) return [{ global: null }];

  const agentScopes = normalizeStringList(
    source.AgentUuid ?? source.agent_uuid,
  ).map((value) => ({ agent_uuid: value }) satisfies TokenLimitScopeItem);
  if (agentScopes.length > 0) return agentScopes;

  const kvScopes = normalizeStringList(
    source.KvNamespace ?? source.kv_namespace,
  ).map((value) => ({ kv_namespace: value }) satisfies TokenLimitScopeItem);
  if (kvScopes.length > 0) return kvScopes;

  return [];
};

export const normalizeScopes = (scopes: unknown): TokenLimitScope => {
  if (!Array.isArray(scopes) || scopes.length === 0) return DEFAULT_SCOPE;

  const normalized = scopes.flatMap(normalizeScopeItem);
  return normalized.length > 0 ? normalized : DEFAULT_SCOPE;
};

export const normalizePermissions = (
  permissions: unknown,
): PermissionEntry[] => {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter(
    (permission): permission is PermissionEntry =>
      !!permission &&
      typeof permission === "object" &&
      !Array.isArray(permission),
  );
};

export const normalizeTokenLimit = (tokenLimit: unknown): TokenLimitEntry[] => {
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

export const serializeScopeItem = (item: TokenLimitScopeItem) => {
  if ("global" in item) return "global";
  if ("agent_uuid" in item) return { agent_uuid: item.agent_uuid };
  if ("kv_namespace" in item) return { kv_namespace: item.kv_namespace };
  return "global";
};

export const buildLimitPayload = (token: Token) => {
  return (token.token_limit ?? []).map((item) => ({
    scopes: (item.scopes ?? []).map(serializeScopeItem),
    permissions: normalizePermissions(item.permissions),
  }));
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
