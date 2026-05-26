import type { PermissionEntry } from "../../type";

export type PermissionBucketKey =
  | "staticMonitoringPermissions"
  | "dynamicMonitoringPermissions"
  | "dynamicMonitoringSummaryPermissions"
  | "taskPermissions"
  | "crontabPermissions"
  | "crontabResultPermissions"
  | "kvPermissions"
  | "terminalPermissions"
  | "nodeGetPermissions"
  | "jsWorkerPermissions"
  | "jsResultPermissions"
  | "unknownPermissions";

export type PermissionBuckets = Record<PermissionBucketKey, PermissionEntry[]>;

export const createEmptyPermissionBuckets = (): PermissionBuckets => ({
  staticMonitoringPermissions: [],
  dynamicMonitoringPermissions: [],
  dynamicMonitoringSummaryPermissions: [],
  taskPermissions: [],
  crontabPermissions: [],
  crontabResultPermissions: [],
  kvPermissions: [],
  terminalPermissions: [],
  nodeGetPermissions: [],
  jsWorkerPermissions: [],
  jsResultPermissions: [],
  unknownPermissions: [],
});

export const createPermissionBuckets = (
  permissions: PermissionEntry[],
): PermissionBuckets => {
  const buckets = createEmptyPermissionBuckets();

  for (const entry of permissions || []) {
    if ("static_monitoring" in entry) {
      buckets.staticMonitoringPermissions.push(entry);
      continue;
    }
    if ("dynamic_monitoring" in entry) {
      buckets.dynamicMonitoringPermissions.push(entry);
      continue;
    }
    if ("dynamic_monitoring_summary" in entry) {
      buckets.dynamicMonitoringSummaryPermissions.push(entry);
      continue;
    }
    if ("task" in entry) {
      buckets.taskPermissions.push(entry);
      continue;
    }
    if ("crontab" in entry) {
      buckets.crontabPermissions.push(entry);
      continue;
    }
    if ("crontab_result" in entry) {
      buckets.crontabResultPermissions.push(entry);
      continue;
    }
    if ("kv" in entry) {
      buckets.kvPermissions.push(entry);
      continue;
    }
    if ("terminal" in entry) {
      buckets.terminalPermissions.push(entry);
      continue;
    }
    if ("node_get" in entry || "nodeget" in entry) {
      buckets.nodeGetPermissions.push(entry);
      continue;
    }
    if ("js_worker" in entry) {
      buckets.jsWorkerPermissions.push(entry);
      continue;
    }
    if ("js_result" in entry) {
      buckets.jsResultPermissions.push(entry);
      continue;
    }
    buckets.unknownPermissions.push(entry);
  }

  return buckets;
};

export const mergePermissionBuckets = (
  buckets: PermissionBuckets,
  canShowKvPermission: boolean,
  canShowCrontabResultPermission: boolean,
): PermissionEntry[] => {
  return [
    ...buckets.staticMonitoringPermissions,
    ...buckets.dynamicMonitoringPermissions,
    ...buckets.dynamicMonitoringSummaryPermissions,
    ...buckets.taskPermissions,
    ...buckets.crontabPermissions,
    ...(canShowCrontabResultPermission ? buckets.crontabResultPermissions : []),
    ...(canShowKvPermission ? buckets.kvPermissions : []),
    ...buckets.terminalPermissions,
    ...buckets.nodeGetPermissions,
    ...buckets.jsWorkerPermissions,
    ...buckets.jsResultPermissions,
    ...buckets.unknownPermissions,
  ];
};

export const replacePermissionBucket = (
  permissions: PermissionEntry[],
  key: PermissionBucketKey,
  nextValue: PermissionEntry[],
  canShowKvPermission: boolean,
  canShowCrontabResultPermission: boolean,
) => {
  const buckets = createPermissionBuckets(permissions);
  buckets[key] = nextValue;
  return mergePermissionBuckets(
    buckets,
    canShowKvPermission,
    canShowCrontabResultPermission,
  );
};

export const arePermissionEntriesEqual = (
  left: PermissionEntry[] | undefined,
  right: PermissionEntry[] | undefined,
) => {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
};
