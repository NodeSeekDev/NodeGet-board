<script setup lang="ts">
import { Package } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.node.docker",
    icon: Package,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
