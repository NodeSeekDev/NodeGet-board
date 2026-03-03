export type PermissionValue = string | Record<string, unknown>

export interface PermissionEntry {
  [resource: string]: PermissionValue
}

export type ScopeEntry =
  | 'global'
  | { global?: null; agent_uuid?: string; kv_namespace?: string }
  | string

export interface TokenLimit {
  scopes?: ScopeEntry[]
  permissions?: PermissionEntry[]
}

export interface TokenInfo {
  version?: number
  token_key?: string
  timestamp_from?: number | null
  timestamp_to?: number | null
  username?: string | null
  token_limit?: TokenLimit[]
}

export type PermissionScopeType = 'global' | 'agent_uuid' | 'kv_namespace'

export interface ParsedScope {
  type: PermissionScopeType
  value: string
}

export interface ParsedPermission {
  resource: string
  action: string
  target?: string
}

export interface PermissionRule {
  scopeType: PermissionScopeType
  scopeValue: string
  resource: string
  action: string
  target?: string
}

export interface PermissionSpec {
  resource: string
  action: string
  target: string
}
