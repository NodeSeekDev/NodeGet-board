import type {
  ParsedPermission,
  ParsedScope,
  PermissionEntry,
  PermissionRule,
  PermissionScopeType,
  PermissionSpec,
  ScopeEntry,
  TokenInfo,
} from './types'

/**
 * 本文件职责：
 * 1) 把后端 token_limit 拍平成统一的 PermissionRule[]
 * 2) 基于 `resource:action[:target]` 判断是否有权限
 *
 * 核心流程：
 * token_limit -> normalizeScope/parsePermissionEntry -> flattenTokenRules
 * -> hasPermissionBySpec / hasAnyScopePermissionBySpec
 */
const GLOBAL_SCOPE: ParsedScope = { type: 'global', value: 'global' }
const wildcardRegexCache = new Map<string, RegExp>()

/**
 * 统一文本规范，避免大小写/空格导致匹配失败。
 */
export const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase()

/**
 * 把 scope 输入标准化成 ParsedScope。
 *
 * 支持格式：
 * - 'global'
 * - 'agent_uuid:xxx' / 'kv_namespace:xxx'
 * - { global: null } / { agent_uuid: 'xxx' } / { kv_namespace: 'xxx' }
 *
 * 非法 scope 返回 null。
 */
const normalizeScope = (scope: ScopeEntry): ParsedScope | null => {
  if (scope === 'global') return GLOBAL_SCOPE

  if (typeof scope === 'string') {
    const normalized = normalizeText(scope)
    if (normalized === 'global') return GLOBAL_SCOPE

    if (normalized.startsWith('agent_uuid:')) {
      const value = normalizeText(normalized.slice('agent_uuid:'.length))
      if (value) return { type: 'agent_uuid', value }
      return null
    }

    if (normalized.startsWith('kv_namespace:')) {
      const value = normalizeText(normalized.slice('kv_namespace:'.length))
      if (value) return { type: 'kv_namespace', value }
      return null
    }

    return null
  }

  if (!scope || typeof scope !== 'object') return null
  if ('global' in scope) return GLOBAL_SCOPE

  if (typeof scope.agent_uuid === 'string') {
    const value = normalizeText(scope.agent_uuid)
    if (value) return { type: 'agent_uuid', value }
  }

  if (typeof scope.kv_namespace === 'string') {
    const value = normalizeText(scope.kv_namespace)
    if (value) return { type: 'kv_namespace', value }
  }

  return null
}

/**
 * 把一条 permissions entry 拆成多条标准权限项。
 *
 * 输入示例：
 * `{ task: 'listen', kv: { read: 'metadata_*' } }`
 *
 * 输出示例：
 * `[{ resource: 'task', action: 'listen' }, { resource: 'kv', action: 'read', target: 'metadata_*' }]`
 */
const parsePermissionEntry = (entry: PermissionEntry): ParsedPermission[] => {
  const permissions: ParsedPermission[] = []

  for (const [resourceRaw, value] of Object.entries(entry)) {
    const resource = normalizeText(resourceRaw)
    if (!resource) continue

    if (typeof value === 'string') {
      const action = normalizeText(value)
      if (!action) continue
      permissions.push({ resource, action })
      continue
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) continue

    for (const [actionRaw, targetRaw] of Object.entries(value)) {
      const action = normalizeText(actionRaw)
      if (!action) continue

      const target = normalizeText(targetRaw)
      if (target) {
        permissions.push({ resource, action, target })
      } else {
        permissions.push({ resource, action })
      }
    }
  }

  return permissions
}

/**
 * 解析权限规格字符串：`resource:action[:target]`。
 *
 * 示例：
 * - `task:create:web_shell` -> { resource: 'task', action: 'create', target: 'web_shell' }
 * - `task:listen` -> { resource: 'task', action: 'listen', target: '' }
 */
const parsePermissionSpec = (specRaw: string): PermissionSpec | null => {
  const [resourceRaw, actionRaw, ...targetParts] = String(specRaw ?? '').split(':')
  const resource = normalizeText(resourceRaw)
  const action = normalizeText(actionRaw)
  const target = normalizeText(targetParts.join(':'))
  if (!resource || !action) return null
  return { resource, action, target }
}

/**
 * 把外部传入的 scope 字符串转成标准 scope。
 */
const normalizeScopeInput = (scopeRaw?: string): ParsedScope | null => {
  if (!scopeRaw) return null
  return normalizeScope(scopeRaw)
}

/**
 * 资源与作用域兼容性约束：
 * - kv: 只允许 global / kv_namespace
 * - 其他资源: 只允许 global / agent_uuid
 */
const isScopeCompatible = (resource: string, scopeType: PermissionScopeType) => {
  if (resource === 'kv') {
    return scopeType === 'global' || scopeType === 'kv_namespace'
  }
  return scopeType === 'global' || scopeType === 'agent_uuid'
}

/**
 * 通配符匹配（仅支持 `*`）。
 * - `*` 代表任意字符串
 * - 使用缓存避免重复构造正则
 */
const matchWildcard = (patternRaw: string, inputRaw: string) => {
  const pattern = normalizeText(patternRaw)
  const input = normalizeText(inputRaw)

  if (!pattern || !input) return false
  if (pattern === '*') return true
  if (!pattern.includes('*')) return pattern === input

  const cached = wildcardRegexCache.get(pattern)
  if (cached) return cached.test(input)

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
  wildcardRegexCache.set(pattern, regex)
  return regex.test(input)
}

/**
 * 判断规则作用域是否命中请求作用域。
 *
 * 约定：
 * - 未指定 scope（或 scope=global）时，仅匹配 global 规则
 * - 指定非 global scope 时，global 规则和同类型同值规则都算命中
 */
const isRuleScopeMatched = (rule: PermissionRule, requestedScope: ParsedScope | null) => {
  if (!requestedScope || requestedScope.type === 'global') {
    return rule.scopeType === 'global'
  }

  return (
    rule.scopeType === 'global'
    || (rule.scopeType === requestedScope.type && rule.scopeValue === requestedScope.value)
  )
}

/**
 * 判断规则 target 是否命中请求 target。
 *
 * 约定：
 * - 请求没带 target：按“只看 resource+action”放行
 * - 规则没带 target：视为该 action 下全部 target 可用
 * - kv 资源支持通配符匹配，其它资源按字符串全等
 */
const isRuleTargetMatched = (rule: PermissionRule, spec: PermissionSpec) => {
  if (!spec.target) return true
  if (!rule.target) return true
  if (spec.resource === 'kv') return matchWildcard(rule.target, spec.target)
  return rule.target === spec.target
}

/**
 * 把规则作用域转成统一字符串键，便于 UI 展示和去重。
 * - global -> 'global'
 * - agent_uuid/a1 -> 'agent_uuid:a1'
 */
export const scopeKey = (rule: PermissionRule) => {
  if (rule.scopeType === 'global') return 'global'
  return `${rule.scopeType}:${rule.scopeValue}`
}

/**
 * 把 token_limit 拍平成 PermissionRule[]。
 *
 * 行为要点：
 * - 没有合法 scopes 时，默认使用 global
 * - 每个 permission 会按兼容 scope 扩展成多条 rule
 * - 若 scope 全不兼容（理论兜底），回退到 global
 */
export const flattenTokenRules = (token: TokenInfo | null): PermissionRule[] => {
  const rules: PermissionRule[] = []
  const limits = token?.token_limit ?? []

  for (const limit of limits) {
    const parsedScopes = (limit.scopes ?? [])
      .map(normalizeScope)
      .filter((scope): scope is ParsedScope => Boolean(scope))

    const scopes = parsedScopes.length > 0 ? parsedScopes : [GLOBAL_SCOPE]
    const parsedPermissions = (limit.permissions ?? []).flatMap(parsePermissionEntry)

    for (const permission of parsedPermissions) {
      const applicableScopes = scopes.filter((scope) => isScopeCompatible(permission.resource, scope.type))
      const effectiveScopes = applicableScopes.length > 0 ? applicableScopes : [GLOBAL_SCOPE]

      for (const scope of effectiveScopes) {
        rules.push({
          scopeType: scope.type,
          scopeValue: scope.value,
          resource: permission.resource,
          action: permission.action,
          target: permission.target,
        })
      }
    }
  }

  return rules
}

/**
 * 判断“在指定 scope 下”是否拥有某权限。
 *
 * @param rules 已拍平权限规则
 * @param permissionSpec 权限规格：`resource:action[:target]`
 * @param scope 可选，`global` / `agent_uuid:xxx` / `kv_namespace:xxx`
 */
export const hasPermissionBySpec = (rules: PermissionRule[], permissionSpec: string, scope?: string) => {
  const spec = parsePermissionSpec(permissionSpec)
  if (!spec) return false

  const requestedScope = normalizeScopeInput(scope)
  if (scope && !requestedScope) return false

  return rules.some((rule) => {
    if (rule.resource !== spec.resource || rule.action !== spec.action) return false
    if (!isRuleScopeMatched(rule, requestedScope)) return false
    return isRuleTargetMatched(rule, spec)
  })
}

/**
 * 判断“任意 scope”下是否拥有某权限。
 * 常用于“是否展示某功能入口”这类场景。
 */
export const hasAnyScopePermissionBySpec = (rules: PermissionRule[], permissionSpec: string) => {
  const spec = parsePermissionSpec(permissionSpec)
  if (!spec) return false

  return rules.some((rule) => {
    if (rule.resource !== spec.resource || rule.action !== spec.action) return false
    return isRuleTargetMatched(rule, spec)
  })
}
