import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Backend } from '@/composables/useBackendStore'
import { wsRpcCall } from '@/composables/useWsRpc'
import type { PermissionRule, TokenInfo } from '@/stores/permission/types'
import {
  flattenTokenRules,
  hasAnyScopePermissionBySpec,
  hasPermissionBySpec,
  normalizeText,
  scopeKey,
} from './utils'

/**
 * 权限设计
 * - 后端的 token_limit 会被拍平成 rules：每条 rule 只描述一件事：
 *   在某个 scope 下，对某个 resource 做某个 action（可带 target）。
 * - scope 约束：
 *   - kv 只认 global / kv_namespace
 *   - 非 kv 只认 global / agent_uuid
 *
 * 拍平示例
 * - 输入：
 *   scopes = ['global', { agent_uuid: 'a1' }, { kv_namespace: 'ns1' }]
 *   permissions = [{ task: 'listen' }, { kv: { read: 'metadata_*' } }]
 * - 输出 rules：
 *   1) global + task + listen
 *   2) agent_uuid:a1 + task + listen
 *   3) global + kv + read + metadata_*
 *   4) kv_namespace:ns1 + kv + read + metadata_*
 *
 * 使用
 * - 先调用 refreshByBackend(backend) 拉取并拍平权限。
 * - 普通权限：hasPermission('task:create:web_shell', 'agent_uuid:agent-a')
 * - KV 权限：hasPermission('kv:read:metadata_cpu', 'kv_namespace:ns1')
 */
export type { PermissionRule, TokenInfo } from '@/stores/permission/types'

export const usePermissionStore = defineStore('permission', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const tokenInfo = ref<TokenInfo | null>(null)
  const currentBackendKey = ref('')
  const rules = ref<PermissionRule[]>([])

  const isSuperToken = computed(() => normalizeText(tokenInfo.value?.username) === 'root')

  const tokenLimits = computed(() => ({
    general: rules.value.filter((rule) => rule.resource !== 'kv'),
    kv: rules.value.filter((rule) => rule.resource === 'kv'),
  }))

  const availableScopes = computed(() => [...new Set(rules.value.map(scopeKey))])

  /**
   * 清空权限上下文（常用于登出、切换后端、token 失效）。
   *
   * @example
   * const permissionStore = usePermissionStore()
   * permissionStore.clear()
   */
  const clear = () => {
    status.value = 'idle'
    error.value = ''
    tokenInfo.value = null
    currentBackendKey.value = ''
    rules.value = []
  }

  /**
   * 按当前后端配置拉取 token 信息并刷新权限规则。
   * - 会自动把后端 token_limit 拍平到 `rules`
   * - 相同 `url + token` 且已 ready 时会跳过重复请求
   *
   * @param backend 当前后端配置（来自 useBackendStore）
   *
   * @example
   * const permissionStore = usePermissionStore()
   * await permissionStore.refreshByBackend(activeBackend)
   *
   * @example
   * // 当 backend 为空时会自动 clear，避免使用脏权限
   * await permissionStore.refreshByBackend(null)
   */
  const refreshByBackend = async (backend: Backend | null) => {
    if (!backend?.url || !backend?.token) {
      clear()
      return
    }

    const backendKey = `${backend.url}::${backend.token}`
    if (backendKey === currentBackendKey.value && status.value === 'ready') return

    status.value = 'loading'
    error.value = ''
    currentBackendKey.value = backendKey

    try {
      const result = await wsRpcCall<TokenInfo>(backend.url, 'token_get', { token: backend.token })
      if (!result || typeof result !== 'object') {
        throw new Error('token_get empty result')
      }

      tokenInfo.value = result
      rules.value = flattenTokenRules(result)
      status.value = 'ready'
    } catch (e: unknown) {
      tokenInfo.value = null
      rules.value = []
      status.value = 'error'
      error.value = e instanceof Error ? e.message : 'Failed to fetch token permissions'
    }
  }

  /**
   * 判断某个 scope 下是否拥有指定权限。
   * - `permissionSpec` 格式：`resource:action[:target]`
   * - 非 root token 会按已拍平规则精确匹配；root 直接返回 true
   *
   * @param permissionSpec 例如 `task:create:web_shell`、`kv:read:metadata_cpu`
   * @param scope 例如 `global`、`agent_uuid:agent-a`、`kv_namespace:ns1`
   *
   * @example
   * // 判断 agent 作用域权限
   * permissionStore.hasPermission('task:listen', 'agent_uuid:agent-a')
   *
   * @example
   * // KV 支持通配匹配，metadata_* 可命中 metadata_cpu
   * permissionStore.hasPermission('kv:read:metadata_cpu', 'kv_namespace:ns1')
   */
  const hasPermission = (permissionSpec: string, scope?: string) => {
    if (isSuperToken.value) return true
    return hasPermissionBySpec(rules.value, permissionSpec, scope)
  }

  /**
   * 判断在任意 scope 下是否有指定权限。
   * 常用于 UI 显示层：只需要“有没有这个能力”，不关心具体 scope。
   *
   * @param permissionSpec 例如 `task:create`、`kv:read:metadata_cpu`
   *
   * @example
   * // 只要任意一个作用域能创建 task，就显示创建入口
   * if (permissionStore.hasAnyScopePermission('task:create')) {
   *   showCreateButton.value = true
   * }
   */
  const hasAnyScopePermission = (permissionSpec: string) => {
    if (isSuperToken.value) return true
    return hasAnyScopePermissionBySpec(rules.value, permissionSpec)
  }

  return {
    status,
    error,
    tokenInfo,
    isSuperToken,
    rules,
    tokenLimits,
    availableScopes,
    refreshByBackend,
    clear,
    hasPermission,
    hasAnyScopePermission,
  }
})
