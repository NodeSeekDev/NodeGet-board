export type token = {
  username: string;
  password: string;
  timestamp_from: number;
  timestamp_to: number;
  version: number;
  token_limit: Array<TokenLimitEntry>;
};

export type TokenLimitEntry = {
  scopes: TokenLimitScope;
  permissions: PermissionEntry[];
};

export type TokenLimitScope = Array<TokenLimitScopeItem>;

export type TokenLimitScopeItem =
  | {
      global: null;
    }
  | {
      AgentUuid: string[] | null;
    }
  | {
      KvNamespace: string[] | null;
    };

export type PermissionEntry = Record<string, unknown>;

export type UuidList = {
  uuids: string[];
};

// 权限Item type
export type PermissionItemConfig = {
  name_zn: string;
  name: string;
  value: Record<string, unknown>;
};
