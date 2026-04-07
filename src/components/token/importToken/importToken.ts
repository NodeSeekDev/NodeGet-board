import {
  DEFAULT_SCOPE,
  createDefaultToken,
  normalizePermissions,
} from "../scopeCodec";
import type { PermissionEntry, Token } from "../type";

const STATIC_MONITORING_READ_FIELDS = new Set(["cpu", "system", "gpu"]);
const DYNAMIC_MONITORING_FIELDS = new Set([
  "cpu",
  "ram",
  "load",
  "system",
  "disk",
  "network",
  "gpu",
]);
const TASK_TYPES = new Set([
  "ping",
  "tcp_ping",
  "http_ping",
  "web_shell",
  "execute",
  "ip",
  "read_config",
  "edit_config",
]);
const CRONTAB_TYPES = new Set(["read", "write", "delete"]);

const ensureFiniteNumber = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`invalid_${fieldName}`);
  }

  return value;
};

const ensureOptionalString = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new Error(`invalid_${fieldName}`);
  }

  return value;
};

const ensureNonEmptyString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_${fieldName}`);
  }

  return value.trim();
};

const ensureAllowedValue = (
  value: string,
  allowed: Set<string>,
  fieldName: string,
) => {
  if (!allowed.has(value)) {
    throw new Error(`invalid_${fieldName}`);
  }
};

const ensureSingleKeyObject = (value: unknown, fieldName: string) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid_${fieldName}`);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== 1) {
    throw new Error(`invalid_${fieldName}`);
  }

  return entries[0]!;
};

const validatePermissionEntry = (entry: PermissionEntry, index: number) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`invalid_permission_${index}`);
  }

  if ("static_monitoring" in entry) {
    const value = entry.static_monitoring;
    if (value === "write" || value === "delete") return;
    const [action, target] = ensureSingleKeyObject(
      value,
      `static_monitoring_${index}`,
    );
    if (action !== "read" && action !== "write") {
      throw new Error(`invalid_static_monitoring_${index}`);
    }
    const normalizedTarget = ensureNonEmptyString(
      target,
      `static_monitoring_${index}`,
    );
    if (action === "read") {
      ensureAllowedValue(
        normalizedTarget,
        STATIC_MONITORING_READ_FIELDS,
        `static_monitoring_${index}`,
      );
      return;
    }
    return;
  }

  if ("dynamic_monitoring" in entry) {
    const value = entry.dynamic_monitoring;
    if (value === "write" || value === "delete") return;
    const [action, target] = ensureSingleKeyObject(
      value,
      `dynamic_monitoring_${index}`,
    );
    if (action !== "read") {
      throw new Error(`invalid_dynamic_monitoring_${index}`);
    }
    ensureAllowedValue(
      ensureNonEmptyString(target, `dynamic_monitoring_${index}`),
      DYNAMIC_MONITORING_FIELDS,
      `dynamic_monitoring_${index}`,
    );
    return;
  }

  if ("task" in entry) {
    const value = entry.task;
    if (value === "listen") return;
    const [action, target] = ensureSingleKeyObject(value, `task_${index}`);
    if (action !== "create" && action !== "read" && action !== "write") {
      throw new Error(`invalid_task_${index}`);
    }
    ensureAllowedValue(
      ensureNonEmptyString(target, `task_${index}`),
      TASK_TYPES,
      `task_${index}`,
    );
    return;
  }

  if ("crontab" in entry) {
    const value = ensureNonEmptyString(entry.crontab, `crontab_${index}`);
    ensureAllowedValue(value, CRONTAB_TYPES, `crontab_${index}`);
    return;
  }

  if ("crontab_result" in entry) {
    const [action, target] = ensureSingleKeyObject(
      entry.crontab_result,
      `crontab_result_${index}`,
    );
    if (action !== "read" && action !== "delete") {
      throw new Error(`invalid_crontab_result_${index}`);
    }
    ensureNonEmptyString(target, `crontab_result_${index}`);
    return;
  }

  if ("kv" in entry) {
    const value = entry.kv;
    if (value === "list_all_keys" || value === "list_all_namespace") return;
    const [action, target] = ensureSingleKeyObject(value, `kv_${index}`);
    if (action !== "read" && action !== "write" && action !== "delete") {
      throw new Error(`invalid_kv_${index}`);
    }
    ensureNonEmptyString(target, `kv_${index}`);
    return;
  }

  if ("terminal" in entry) {
    const value = ensureNonEmptyString(entry.terminal, `terminal_${index}`);
    if (value !== "connect") {
      throw new Error(`invalid_terminal_${index}`);
    }
    return;
  }

  if ("node_get" in entry || "nodeget" in entry) {
    const rawValue = "node_get" in entry ? entry.node_get : entry.nodeget;
    const value = ensureNonEmptyString(rawValue, `node_get_${index}`);
    if (value !== "list_all_agent_uuid") {
      throw new Error(`invalid_node_get_${index}`);
    }
    return;
  }

  throw new Error(`unsupported_permission_${index}`);
};

const ensureTokenLimit = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("invalid_token_limit");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`invalid_token_limit_item_${index}`);
    }

    const entry = item as Record<string, unknown>;
    if (!Array.isArray(entry.scopes) || entry.scopes.length === 0) {
      throw new Error(`invalid_token_limit_scopes_${index}`);
    }

    if (!Array.isArray(entry.permissions)) {
      throw new Error(`invalid_token_limit_permissions_${index}`);
    }

    const permissions = normalizePermissions(entry.permissions);
    if (permissions.length !== entry.permissions.length) {
      throw new Error(`invalid_token_limit_permissions_${index}`);
    }
    permissions.forEach((permission, permissionIndex) => {
      validatePermissionEntry(permission, permissionIndex);
    });

    return {
      scopes: [...DEFAULT_SCOPE],
      permissions,
    };
  });
};

const withImportedUsernameSuffix = (value: string) => {
  const username = value.trim();
  return username ? `${username}_import` : "";
};

const resetImportedScopes = (token: Token): Token => {
  return {
    ...token,
    token_limit: token.token_limit.map((item) => ({
      scopes: [...DEFAULT_SCOPE],
      permissions: normalizePermissions(item.permissions),
    })),
  };
};

export const mapImportedTokenToForm = (payload: unknown): Token => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_token_payload");
  }

  const source = payload as Record<string, unknown>;
  const token = createDefaultToken();

  const mapped: Token = {
    ...token,
    version: ensureFiniteNumber(source.version, "version"),
    username: withImportedUsernameSuffix(
      ensureOptionalString(source.username, "username"),
    ),
    password: ensureOptionalString(source.password, "password"),
    timestamp_from: ensureFiniteNumber(source.timestamp_from, "timestamp_from"),
    timestamp_to: ensureFiniteNumber(source.timestamp_to, "timestamp_to"),
    token_limit: ensureTokenLimit(source.token_limit),
  };

  return resetImportedScopes(mapped);
};

export const parseImportedTokenJson = (value: string): Token => {
  const source = value.trim();
  if (!source) {
    throw new Error("empty_token_payload");
  }

  const parsed = JSON.parse(source) as unknown;
  return mapImportedTokenToForm(parsed);
};
