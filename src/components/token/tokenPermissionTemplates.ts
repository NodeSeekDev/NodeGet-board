import type { ScopeTabValue } from "./scopeUi";
import type { PermissionEntry, TokenLimitEntry, TokenLimitScope } from "./type";
import { arePermissionEntriesEqual } from "./components/permissions/permissionsState";
import { DEFAULT_SCOPE } from "./scopeCodec";

export type TokenPermissionTemplateValue = "agent" | "visitor" | "custom";

type TokenPermissionTemplateOption = {
  value: TokenPermissionTemplateValue;
  label: string;
  description: string;
};

type TokenPermissionTemplateConfig = TokenPermissionTemplateOption & {
  buildPermissions: () => PermissionEntry[];
  matches: (
    tokenLimit: TokenLimitEntry,
    currentScopeTab: ScopeTabValue,
  ) => boolean;
  apply: (tokenLimit: TokenLimitEntry) => {
    tokenLimit: TokenLimitEntry;
    scopeTab: ScopeTabValue;
  };
};

const AGENT_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: "write" },
  { dynamic_monitoring: "write" },
  { task: "listen" },
];

const VISITOR_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: { read: "cpu" } },
  { static_monitoring: { read: "system" } },
  { dynamic_monitoring: { read: "cpu" } },
  { dynamic_monitoring: { read: "system" } },
];

const normalizeAgentTemplateScopes = (
  scopes: TokenLimitScope,
): TokenLimitScope => {
  const agentScopes = (scopes ?? []).filter((item) => "agent_uuid" in item);
  return agentScopes.length > 0 ? agentScopes : [];
};

const normalizeGlobalTemplateScopes = (): TokenLimitScope => [...DEFAULT_SCOPE];

export const TOKEN_PERMISSION_TEMPLATE_OPTIONS: TokenPermissionTemplateOption[] =
  [
    {
      value: "agent",
      label: "Agent",
      description: "面向 Agent 使用场景的预设模版。",
    },
    {
      value: "visitor",
      label: "Visitor",
      description: "Agent 作用域下的访客只读监控模版。",
    },
    {
      value: "custom",
      label: "自定义",
      description: "手动配置作用域和权限内容。",
    },
  ];

const AGENT_TEMPLATE_OPTION: TokenPermissionTemplateOption = {
  value: "agent",
  label: "Agent",
  description: "面向 Agent 使用场景的预设模版。",
};

const VISITOR_TEMPLATE_OPTION: TokenPermissionTemplateOption = {
  value: "visitor",
  label: "Visitor",
  description: "Agent 作用域下的访客只读监控模版。",
};

const TEMPLATE_CONFIGS: Record<
  Exclude<TokenPermissionTemplateValue, "custom">,
  TokenPermissionTemplateConfig
> = {
  agent: {
    ...AGENT_TEMPLATE_OPTION,
    buildPermissions: () => AGENT_PERMISSIONS.map((item) => ({ ...item })),
    matches: (tokenLimit, currentScopeTab) => {
      if (currentScopeTab !== "Global") return false;
      return arePermissionEntriesEqual(
        tokenLimit.permissions ?? [],
        AGENT_PERMISSIONS,
      );
    },
    apply: (tokenLimit) => ({
      tokenLimit: {
        ...tokenLimit,
        scopes: normalizeGlobalTemplateScopes(),
        permissions: AGENT_PERMISSIONS.map((item) => ({ ...item })),
      },
      scopeTab: "Global",
    }),
  },
  visitor: {
    ...VISITOR_TEMPLATE_OPTION,
    buildPermissions: () => VISITOR_PERMISSIONS.map((item) => ({ ...item })),
    matches: (tokenLimit, currentScopeTab) => {
      if (currentScopeTab !== "AgentUuid") return false;
      return arePermissionEntriesEqual(
        tokenLimit.permissions ?? [],
        VISITOR_PERMISSIONS,
      );
    },
    apply: (tokenLimit) => ({
      tokenLimit: {
        ...tokenLimit,
        scopes: normalizeAgentTemplateScopes(tokenLimit.scopes),
        permissions: VISITOR_PERMISSIONS.map((item) => ({ ...item })),
      },
      scopeTab: "AgentUuid",
    }),
  },
};

export const applyTokenPermissionTemplate = (
  template: TokenPermissionTemplateValue,
  tokenLimit: TokenLimitEntry,
) => {
  if (template === "custom") {
    return {
      tokenLimit: {
        ...tokenLimit,
      },
      scopeTab: "Global" as ScopeTabValue,
    };
  }

  return TEMPLATE_CONFIGS[template].apply(tokenLimit);
};

export const detectTokenPermissionTemplate = (
  tokenLimit: TokenLimitEntry,
  currentScopeTab: ScopeTabValue,
): TokenPermissionTemplateValue => {
  for (const template of Object.values(TEMPLATE_CONFIGS)) {
    if (template.matches(tokenLimit, currentScopeTab)) {
      return template.value;
    }
  }

  return "custom";
};
