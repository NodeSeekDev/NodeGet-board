<script setup lang="ts">
import { Box } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.appPanel",
    icon: Box,
    order: 11,
    group: "router.group.appExtensions",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
