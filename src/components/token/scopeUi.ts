import type { TokenLimitScope } from "./type.js";

export type ScopeTabValue = "Global" | "AgentUuid" | "KvNamespace" | "JsWorker";

// 根据scope值计算当前选中的tab
export const detectScopeTab = (
  scope: TokenLimitScope,
  fallback: ScopeTabValue = "Global",
): ScopeTabValue => {
  if ((scope ?? []).some((item) => "agent_uuid" in item)) return "AgentUuid";
  if ((scope ?? []).some((item) => "kv_namespace" in item)) {
    return "KvNamespace";
  }
  if ((scope ?? []).some((item) => "js_worker" in item)) {
    return "JsWorker";
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

// 根据scope值计算当前选中的kv_namespace
export const getSelectedKvNamespaces = (scope: TokenLimitScope) => {
  if (scope.length) {
    const kvNamespaces = scope.filter((item) => "kv_namespace" in item);
    const result = kvNamespaces.map((item) => item.kv_namespace);
    return result.length ? result : [];
  }
  return [];
};

export const getSelectedJsWorkers = (scope: TokenLimitScope) => {
  if (scope.length) {
    const jsWorkers = scope.filter((item) => "js_worker" in item);
    const result = jsWorkers.map((item) => item.js_worker);
    return result.length ? result : [];
  }
  return [];
};
