<script setup lang="ts">
import { onMounted, ref, useId, watch } from "vue";
import { type PermissionEntry, type PermissionItemConfig } from "../../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import permissionsItem from "./permissionsItem.vue";
import { ListEnd } from "lucide-vue-next";

const props = defineProps<{
  permissions: PermissionEntry[];
}>();
const emits = defineEmits<{
  (e: "update:permissions", token: PermissionEntry[]): void;
}>();

const localPermissions = ref<PermissionEntry[]>(props.permissions);
// 权限配置
const PermissionItemConfigList = ref<PermissionItemConfig[]>([
  {
    name: "StaticMonitoring",
    name_zn: "静态监控",
    value: {
      Read: {
        cpu: "cpu",
        system: "system",
        gpu: "gpu",
        disk: "disk",
      },
      Write: {
        cpu: "cpu",
        system: "system",
        gpu: "gpu",
        disk: "disk",
      },
    },
  },
  {
    name: "DynamicMonitoring ",
    name_zn: "动态监控",
    value: {
      Read: {
        cpu: "cpu",
        system: "system",
        gpu: "gpu",
        disk: "disk",
      },
      Write: {
        cpu: "cpu",
        system: "system",
        gpu: "gpu",
        disk: "disk",
      },
    },
  },
  {
    name: "Task ",
    name_zn: "任务",
    value: {
      Create: {
        ping: "ping",
        tcp_ping: "tcp_ping",
        http_ping: "http_ping",
        web_shell: "web_shell",
        execute: "execute",
        ip: "ip",
      },
      Read: {
        ping: "ping",
        tcp_ping: "tcp_ping",
        http_ping: "http_ping",
        web_shell: "web_shell",
        execute: "execute",
        ip: "ip",
      },
      Write: {
        ping: "ping",
        tcp_ping: "tcp_ping",
        http_ping: "http_ping",
        web_shell: "web_shell",
        execute: "execute",
        ip: "ip",
      },
      Listen: "Listen",
    },
  },
  {
    name: "Crontab",
    name_zn: "定时任务",
    value: { Read: "Read", Write: "Write", Delete: "Delete" },
  },
  {
    name: "CrontabResult ",
    name_zn: "定时任务结果",
    value: { Read: "Read", Delete: "Delete" },
  },
  {
    name: "Kv ",
    name_zn: "KV存储",
    value: {
      ListAllKeys: "ListAllKeys",
      Read: "Read",
      Write: "Write",
      Delete: "Delete",
    },
  },
  {
    name: "Terminal ",
    name_zn: "终端",
    value: { Connect: "Connect" },
  },
  {
    name: "NodeGet ",
    name_zn: "节点信息",
    value: { ListAllAgentUuid: "ListAllAgentUuid" },
  },
]);

watch(
  () => props.permissions,
  (value) => {
    localPermissions.value = value;
  },
  { immediate: true },
);

watch(
  localPermissions,
  (value) => {
    emits("update:permissions", value);
  },
  { deep: true },
);

onMounted(() => {});
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2"> 权限 </CardTitle>
    </CardHeader>

    <CardContent class="grid gap-2 space-y-2">
      <permissionsItem
        v-for="(item, index) in PermissionItemConfigList"
        :key="item.name"
        v-model:permissionsItem="permissions[item.name]"
        :configItem="item"
      />
    </CardContent>
  </Card>
</template>
