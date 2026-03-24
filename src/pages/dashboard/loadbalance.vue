<script setup lang="ts">
import { Split } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.loadbalance",
    icon: Split,
    order: 4,
    group: "router.group.nodeManage",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
