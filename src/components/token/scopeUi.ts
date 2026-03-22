import type { TokenLimitScope } from "./type.js";

export type ScopeTabValue = "Global" | "AgentUuid" | "KvNamespace";

// 根据scope值计算当前选中的tab
export const detectScopeTab = (
  scope: TokenLimitScope,
  fallback: ScopeTabValue = "Global",
): ScopeTabValue => {
  if ((scope ?? []).some((item) => "agent_uuid" in item)) return "AgentUuid";
  if ((scope ?? []).some((item) => "kv_namespace" in item)) {
    return "KvNamespace";
  }
  if ((scope ?? []).some((item) => "global" in item)) return "Global";
  return fallback;
};

// 根据scope值计算当前选中的agent_uuid
export const getSelectedAgentUuids = (scope: TokenLimitScope) => {
  if (scope.length) {
    // 过滤出有agent_uuid的scope
    const agentUuids = scope.filter((item) => "agent_uuid" in item);
    const result = agentUuids.map((item) => item.agent_uuid);
    console.log(result);
    return result.length ? result : [];
  }
  return [];
};
