import type { ScopeTabValue } from "./scopeUi";
import type { PermissionEntry, TokenLimitEntry, TokenLimitScope } from "./type";
import { DEFAULT_SCOPE } from "./scopeCodec";

export type TokenPermissionTemplateValue = "agent" | "visitor" | "custom";

type TokenPermissionTemplateOption = {
  value: TokenPermissionTemplateValue;
  label: string;
  description: string;
};

type TokenPermissionTemplateConfig = {
  value: Exclude<TokenPermissionTemplateValue, "custom">;
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

export const AGENT_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: "write" },
  { dynamic_monitoring: "write" },
  { dynamic_monitoring_summary: "write" },
  { task: "listen" },
  { task: { write: "ping" } },
  { task: { write: "tcp_ping" } },
  { task: { write: "http_ping" } },
  { task: { write: "web_shell" } },
  { task: { write: "execute" } },
  { task: { write: "edit_config" } },
  { task: { write: "read_config" } },
  { task: { write: "http_request" } },
  { task: { write: "ip" } },
];

export const VISITOR_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: { read: "cpu" } },
  { static_monitoring: { read: "system" } },
  { static_monitoring: { read: "gpu" } },
  // { dynamic_monitoring: { read: "cpu" } },
  // { dynamic_monitoring: { read: "ram" } },
  // { dynamic_monitoring: { read: "load" } },
  // { dynamic_monitoring: { read: "system" } },
  // { dynamic_monitoring: { read: "disk" } },
  // { dynamic_monitoring: { read: "network" } },
  // { dynamic_monitoring: { read: "gpu" } },
  { dynamic_monitoring_summary: "read" },
  {
    node_get: "list_all_agent_uuid",
  },
  {
    kv: {
      read: "metadata_*",
    },
  },
];

const normalizePermissionValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => normalizePermissionValue(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, nestedValue]) =>
          `${key}:${normalizePermissionValue(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const arePermissionSetsEqual = (
  left: PermissionEntry[] | undefined,
  right: PermissionEntry[] | undefined,
) => {
  const normalizeEntries = (entries: PermissionEntry[] | undefined) =>
    (entries ?? []).map(normalizePermissionValue).sort();

  return (
    JSON.stringify(normalizeEntries(left)) ===
    JSON.stringify(normalizeEntries(right))
  );
};

const normalizeGlobalTemplateScopes = (): TokenLimitScope => [...DEFAULT_SCOPE];

export const getTokenPermissionTemplateOptions = (
  t: (key: string) => string,
): TokenPermissionTemplateOption[] => [
  {
    value: "agent",
    label: t(
      "dashboard.token.permissionsConfig.limitItem.template.agent.title",
    ),
    description: t(
      "dashboard.token.permissionsConfig.limitItem.template.agent.description",
    ),
  },
  {
    value: "visitor",
    label: t(
      "dashboard.token.permissionsConfig.limitItem.template.visitor.title",
    ),
    description: t(
      "dashboard.token.permissionsConfig.limitItem.template.visitor.description",
    ),
  },
  {
    value: "custom",
    label: t(
      "dashboard.token.permissionsConfig.limitItem.template.custom.title",
    ),
    description: t(
      "dashboard.token.permissionsConfig.limitItem.template.custom.description",
    ),
  },
];

const TEMPLATE_CONFIGS: Record<
  Exclude<TokenPermissionTemplateValue, "custom">,
  TokenPermissionTemplateConfig
> = {
  agent: {
    value: "agent",
    buildPermissions: () => AGENT_PERMISSIONS.map((item) => ({ ...item })),
    matches: (tokenLimit, currentScopeTab) => {
      if (currentScopeTab !== "Global") return false;
      return arePermissionSetsEqual(
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
    value: "visitor",
    buildPermissions: () => VISITOR_PERMISSIONS.map((item) => ({ ...item })),
    matches: (tokenLimit, currentScopeTab) => {
      if (currentScopeTab !== "Global") return false;
      return arePermissionSetsEqual(
        tokenLimit.permissions ?? [],
        VISITOR_PERMISSIONS,
      );
    },
    apply: (tokenLimit) => ({
      tokenLimit: {
        ...tokenLimit,
        scopes: normalizeGlobalTemplateScopes(),
        permissions: VISITOR_PERMISSIONS.map((item) => ({ ...item })),
      },
      scopeTab: "Global",
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
