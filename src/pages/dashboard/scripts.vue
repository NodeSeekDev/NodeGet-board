<script setup lang="ts">
import { FileTerminal } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.scripts",
    icon: FileTerminal,
    order: 8,
    group: "router.group.tools",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
