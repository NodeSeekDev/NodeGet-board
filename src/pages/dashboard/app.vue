<script setup lang="ts">
import { LayoutGrid } from "lucide-vue-next";
import RouterViewLayout from "@/layout/components/RouterViewLayout.vue";

definePage({
  redirect: "/dashboard/app/docker",
  meta: {
    title: "router.appEntrance",
    icon: LayoutGrid,
    order: 12,
    group: "router.group.appExtensions",
    isClosed: true,
  },
});
</script>

<template>
  <RouterViewLayout />
</template>
