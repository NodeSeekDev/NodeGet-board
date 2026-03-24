<script setup lang="ts">
import { HardDriveUpload } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.agents",
    icon: HardDriveUpload,
    order: 2,
    group: "router.group.nodeManage",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
