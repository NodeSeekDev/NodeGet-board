<script setup lang="ts">
import { HardDrive } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.files",
    order: 1,
    icon: HardDrive,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
