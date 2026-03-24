<script setup lang="ts">
import { Router } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.servers",
    icon: Router,
    order: 3,
    group: "router.group.nodeManage",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
