<script setup lang="ts">
import { HardDrive } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.node.files",
    icon: HardDrive,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
