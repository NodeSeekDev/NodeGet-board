<script setup lang="ts">
import { ListCheck } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.batchExec",
    icon: ListCheck,
    order: 9,
    group: "router.group.tools",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
