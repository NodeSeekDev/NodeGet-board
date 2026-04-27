<script setup lang="ts">
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PermissionEntry, TokenLimitScope } from "../../type";
import { detectScopeTab, type ScopeTabValue } from "../../scopeUi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StaticMonitoringPermission from "./StaticMonitoringPermission.vue";
import DynamicMonitoringPermission from "./DynamicMonitoringPermission.vue";
import DynamicMonitoringSummaryPermission from "./DynamicMonitoringSummaryPermission.vue";
import TaskPermission from "./TaskPermission.vue";
import CrontabPermission from "./CrontabPermission.vue";
import CrontabResultPermission from "./CrontabResultPermission.vue";
import KvPermission from "./KvPermission.vue";
import TerminalPermission from "./TerminalPermission.vue";
import NodeGetPermission from "./NodeGetPermission.vue";
import JsWorkerPermission from "./JsWorkerPermission.vue";
import JsResultPermission from "./JsResultPermission.vue";
import {
  arePermissionEntriesEqual,
  createPermissionBuckets,
  mergePermissionBuckets,
  replacePermissionBucket,
  type PermissionBucketKey,
} from "./permissionsState";

const props = defineProps<{
  permissions: PermissionEntry[];
  scope: TokenLimitScope;
  scopeTab?: ScopeTabValue;
}>();
const emits = defineEmits<{
  (e: "update:permissions", token: PermissionEntry[]): void;
}>();
const { t } = useI18n();

const currentScopeTab = computed(
  () => props.scopeTab ?? detectScopeTab(props.scope || [], "Global"),
);

const isGlobalScope = computed(() => currentScopeTab.value === "Global");

const canShowKvPermission = computed(() => true);
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

const dynamicMonitoringSummaryPermissions = computed({
  get: () => buckets.value.dynamicMonitoringSummaryPermissions,
  set: (value: PermissionEntry[]) =>
    updateBucket("dynamicMonitoringSummaryPermissions", value),
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

const jsWorkerPermissions = computed({
  get: () => buckets.value.jsWorkerPermissions,
  set: (value: PermissionEntry[]) => updateBucket("jsWorkerPermissions", value),
});

const jsResultPermissions = computed({
  get: () => buckets.value.jsResultPermissions,
  set: (value: PermissionEntry[]) => updateBucket("jsResultPermissions", value),
});

watch(
  [
    () => props.permissions,
    canShowKvPermission,
    canShowCrontabResultPermission,
  ],
  ([permissions, allowKvPermission, allowCrontabResultPermission]) => {
    const normalized = mergePermissionBuckets(
      createPermissionBuckets(permissions ?? []),
      allowKvPermission,
      allowCrontabResultPermission,
    );

    if (!arePermissionEntriesEqual(normalized, permissions ?? [])) {
      emits("update:permissions", normalized);
    }
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        {{
          t("dashboard.token.permissionsConfig.limitItem.permissionCard.title")
        }}
      </CardTitle>
    </CardHeader>

    <CardContent class="grid gap-2 space-y-2">
      <StaticMonitoringPermission v-model="staticMonitoringPermissions" />
      <DynamicMonitoringPermission v-model="dynamicMonitoringPermissions" />
      <DynamicMonitoringSummaryPermission
        v-model="dynamicMonitoringSummaryPermissions"
      />
      <TaskPermission v-model="taskPermissions" />
      <CrontabPermission v-model="crontabPermissions" />
      <CrontabResultPermission
        v-if="canShowCrontabResultPermission"
        v-model="crontabResultPermissions"
      />
      <KvPermission v-model="kvPermissions" />
      <TerminalPermission v-model="terminalPermissions" />
      <NodeGetPermission v-model="nodeGetPermissions" />
      <JsWorkerPermission v-model="jsWorkerPermissions" />
      <JsResultPermission v-model="jsResultPermissions" />
    </CardContent>
  </Card>
</template>
