<script setup lang="ts">
import { computed } from "vue";
import type { PermissionEntry, TokenLimitScope } from "../../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StaticMonitoringPermission from "./StaticMonitoringPermission.vue";
import DynamicMonitoringPermission from "./DynamicMonitoringPermission.vue";
import TaskPermission from "./TaskPermission.vue";
import CrontabPermission from "./CrontabPermission.vue";
import CrontabResultPermission from "./CrontabResultPermission.vue";
import KvPermission from "./KvPermission.vue";
import TerminalPermission from "./TerminalPermission.vue";
import NodeGetPermission from "./NodeGetPermission.vue";
import {
  createPermissionBuckets,
  replacePermissionBucket,
  type PermissionBucketKey,
} from "./permissionsState";

const props = defineProps<{
  permissions: PermissionEntry[];
  scope: TokenLimitScope;
}>();
const emits = defineEmits<{
  (e: "update:permissions", token: PermissionEntry[]): void;
}>();

const isGlobalScope = computed(() => {
  return (props.scope || []).some((item) => "global" in item);
});

const isKvNamespaceScope = computed(() => {
  return (props.scope || []).some((item) => "kv_namespace" in item);
});

const canShowKvPermission = computed(
  () => isGlobalScope.value || isKvNamespaceScope.value,
);
const canShowCrontabResultPermission = computed(() => isGlobalScope.value);

const updateBucket = (key: PermissionBucketKey, value: PermissionEntry[]) => {
  emits(
    "update:permissions",
    replacePermissionBucket(
      props.permissions ?? [],
      key,
      value,
      canShowKvPermission.value,
      canShowCrontabResultPermission.value,
    ),
  );
};

const buckets = computed(() =>
  createPermissionBuckets(props.permissions ?? []),
);

const staticMonitoringPermissions = computed({
  get: () => buckets.value.staticMonitoringPermissions,
  set: (value: PermissionEntry[]) =>
    updateBucket("staticMonitoringPermissions", value),
});

const dynamicMonitoringPermissions = computed({
  get: () => buckets.value.dynamicMonitoringPermissions,
  set: (value: PermissionEntry[]) =>
    updateBucket("dynamicMonitoringPermissions", value),
});

const taskPermissions = computed({
  get: () => buckets.value.taskPermissions,
  set: (value: PermissionEntry[]) => updateBucket("taskPermissions", value),
});

const crontabPermissions = computed({
  get: () => buckets.value.crontabPermissions,
  set: (value: PermissionEntry[]) => updateBucket("crontabPermissions", value),
});

const crontabResultPermissions = computed({
  get: () => buckets.value.crontabResultPermissions,
  set: (value: PermissionEntry[]) =>
    updateBucket("crontabResultPermissions", value),
});

const kvPermissions = computed({
  get: () => buckets.value.kvPermissions,
  set: (value: PermissionEntry[]) => updateBucket("kvPermissions", value),
});

const terminalPermissions = computed({
  get: () => buckets.value.terminalPermissions,
  set: (value: PermissionEntry[]) => updateBucket("terminalPermissions", value),
});

const nodeGetPermissions = computed({
  get: () => buckets.value.nodeGetPermissions,
  set: (value: PermissionEntry[]) => updateBucket("nodeGetPermissions", value),
});
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">Permissions</CardTitle>
    </CardHeader>

    <CardContent class="grid gap-2 space-y-2">
      <StaticMonitoringPermission v-model="staticMonitoringPermissions" />
      <DynamicMonitoringPermission v-model="dynamicMonitoringPermissions" />
      <TaskPermission v-model="taskPermissions" />
      <CrontabPermission v-model="crontabPermissions" />
      <CrontabResultPermission
        v-if="canShowCrontabResultPermission"
        v-model="crontabResultPermissions"
      />
      <KvPermission v-if="canShowKvPermission" v-model="kvPermissions" />
      <TerminalPermission v-model="terminalPermissions" />
      <NodeGetPermission v-model="nodeGetPermissions" />
    </CardContent>
  </Card>
</template>
