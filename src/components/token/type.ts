export type Token = {
  username: string;
  password: string;
  timestamp_from: number;
  timestamp_to: number;
  version: number;
  token_limit: Array<TokenLimitEntry>;
};

export type token = Token;

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
      agent_uuid: string;
    }
  | {
      kv_namespace: string;
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

// Token详情
export type TokenDetail = {
  username: string | null;
  password: string | null;
  token_key: string;
  timestamp_from: number | null;
  timestamp_to: number | null;
  version: number;
  token_limit: Array<TokenLimitEntry>;
};
