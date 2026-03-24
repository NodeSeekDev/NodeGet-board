<script setup lang="ts">
import { ChartNoAxesGantt } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.process",
    order: 4,
    icon: ChartNoAxesGantt,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
