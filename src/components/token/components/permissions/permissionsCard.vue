<script setup lang="ts">
import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StaticMonitoringPermission from "./StaticMonitoringPermission.vue";
import DynamicMonitoringPermission from "./DynamicMonitoringPermission.vue";
import TaskPermission from "./TaskPermission.vue";
import CrontabPermission from "./CrontabPermission.vue";
import CrontabResultPermission from "./CrontabResultPermission.vue";
import KvPermission from "./KvPermission.vue";
import TerminalPermission from "./TerminalPermission.vue";
import NodeGetPermission from "./NodeGetPermission.vue";

const props = defineProps<{ permissions: PermissionEntry[] }>();
const emits = defineEmits<{
  (e: "update:permissions", token: PermissionEntry[]): void;
}>();

const staticMonitoringPermissions = ref<PermissionEntry[]>([]);
const dynamicMonitoringPermissions = ref<PermissionEntry[]>([]);
const taskPermissions = ref<PermissionEntry[]>([]);
const crontabPermissions = ref<PermissionEntry[]>([]);
const crontabResultPermissions = ref<PermissionEntry[]>([]);
const kvPermissions = ref<PermissionEntry[]>([]);
const terminalPermissions = ref<PermissionEntry[]>([]);
const nodeGetPermissions = ref<PermissionEntry[]>([]);
const unknownPermissions = ref<PermissionEntry[]>([]);
const hydrating = ref(false);

const splitPermissions = (permissions: PermissionEntry[]) => {
  staticMonitoringPermissions.value = [];
  dynamicMonitoringPermissions.value = [];
  taskPermissions.value = [];
  crontabPermissions.value = [];
  crontabResultPermissions.value = [];
  kvPermissions.value = [];
  terminalPermissions.value = [];
  nodeGetPermissions.value = [];
  unknownPermissions.value = [];

  for (const entry of permissions || []) {
    if ("static_monitoring" in entry) {
      staticMonitoringPermissions.value.push(entry);
      continue;
    }
    if ("dynamic_monitoring" in entry) {
      dynamicMonitoringPermissions.value.push(entry);
      continue;
    }
    if ("task" in entry) {
      taskPermissions.value.push(entry);
      continue;
    }
    if ("crontab" in entry) {
      crontabPermissions.value.push(entry);
      continue;
    }
    if ("crontab_result" in entry) {
      crontabResultPermissions.value.push(entry);
      continue;
    }
    if ("kv" in entry) {
      kvPermissions.value.push(entry);
      continue;
    }
    if ("terminal" in entry) {
      terminalPermissions.value.push(entry);
      continue;
    }
    if ("nodeget" in entry) {
      nodeGetPermissions.value.push(entry);
      continue;
    }
    unknownPermissions.value.push(entry);
  }
};

const emitAllPermissions = () => {
  if (hydrating.value) return;
  emits("update:permissions", [
    ...staticMonitoringPermissions.value,
    ...dynamicMonitoringPermissions.value,
    ...taskPermissions.value,
    ...crontabPermissions.value,
    ...crontabResultPermissions.value,
    ...kvPermissions.value,
    ...terminalPermissions.value,
    ...nodeGetPermissions.value,
    ...unknownPermissions.value,
  ]);
};

watch(
  () => props.permissions,
  (value) => {
    hydrating.value = true;
    splitPermissions(Array.isArray(value) ? value : []);
    hydrating.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  [
    staticMonitoringPermissions,
    dynamicMonitoringPermissions,
    taskPermissions,
    crontabPermissions,
    crontabResultPermissions,
    kvPermissions,
    terminalPermissions,
    nodeGetPermissions,
  ],
  () => {
    emitAllPermissions();
  },
  { deep: true },
);
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
      <CrontabResultPermission v-model="crontabResultPermissions" />
      <KvPermission v-model="kvPermissions" />
      <TerminalPermission v-model="terminalPermissions" />
      <NodeGetPermission v-model="nodeGetPermissions" />
    </CardContent>
  </Card>
</template>
