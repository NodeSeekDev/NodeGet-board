import type { PermissionEntry } from "../../type.js";

export type KvPermissionState = {
  listAllKeys: boolean;
  listAllNamespace: boolean;
  readTargets: string[];
  writeTargets: string[];
  deleteTargets: string[];
};

const dedupeTargets = (targets: string[]) => {
  return [...new Set(targets.map((item) => item.trim()).filter(Boolean))];
};

export const createEmptyKvPermissionState = (): KvPermissionState => ({
  listAllKeys: false,
  listAllNamespace: false,
  readTargets: [],
  writeTargets: [],
  deleteTargets: [],
});

export const addKvTarget = (targets: string[], input: string) => {
  const value = input.trim();
  if (!value || targets.includes(value)) return targets;
  return [...targets, value];
};

export const removeKvTarget = (targets: string[], target: string) => {
  return targets.filter((item) => item !== target);
};

export const buildKvPermissions = (
  state: KvPermissionState,
): PermissionEntry[] => {
  const result: PermissionEntry[] = [];
  if (state.listAllKeys) result.push({ kv: "list_all_keys" });
  if (state.listAllNamespace) result.push({ kv: "list_all_namespace" });
  for (const target of dedupeTargets(state.readTargets)) {
    result.push({ kv: { read: target } });
  }
  for (const target of dedupeTargets(state.writeTargets)) {
    result.push({ kv: { write: target } });
  }
  for (const target of dedupeTargets(state.deleteTargets)) {
    result.push({ kv: { delete: target } });
  }
  return result;
};

export const hydrateKvPermissions = (
  entries: PermissionEntry[],
): KvPermissionState => {
  const state = createEmptyKvPermissionState();

  for (const entry of entries || []) {
    const value = entry?.kv;
    if (value === "list_all_keys") {
      state.listAllKeys = true;
      continue;
    }
    if (value === "list_all_namespace") {
      state.listAllNamespace = true;
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const obj = value as Record<string, unknown>;
    if (typeof obj.read === "string") state.readTargets.push(obj.read);
    if (typeof obj.write === "string") state.writeTargets.push(obj.write);
    if (typeof obj.delete === "string") state.deleteTargets.push(obj.delete);
  }

  state.readTargets = dedupeTargets(state.readTargets);
  state.writeTargets = dedupeTargets(state.writeTargets);
  state.deleteTargets = dedupeTargets(state.deleteTargets);

  return state;
};

export const isSameKvPermissionState = (
  entries: PermissionEntry[],
  state: KvPermissionState,
) => {
  const normalizedEntries = buildKvPermissions(hydrateKvPermissions(entries));
  const normalizedState = buildKvPermissions(state);
  return JSON.stringify(normalizedEntries) === JSON.stringify(normalizedState);
};
