export type token = {
  username: string;
  password: string;
  timestamp_from: number;
  timestamp_to: number;
  version: number;
  token_limit: Array<TokenLimitEntry>;
};

export type TokenLimitEntry =
  | {
      scopes: TokenLimitScope;
      permissions: PermissionEntry[];
    }
  | undefined;

export type TokenLimitScope = Array<TokenLimitScopeItem> | undefined;

export type TokenLimitScopeItem = Record<string, string | null>;

export type PermissionEntry = Record<string, unknown>;
