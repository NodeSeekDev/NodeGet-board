<script setup lang="ts">
import { Earth } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.map",
    icon: Earth,
    order: 5,
    group: "router.group.nodeManage",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
