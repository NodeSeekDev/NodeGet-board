<script setup lang="ts">
import { Braces } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.jsRuntime",
    icon: Braces,
    order: 10,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
