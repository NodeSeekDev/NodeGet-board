<script setup lang="ts">
import { Package } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.docker",
    order: 2,
    icon: Package,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
