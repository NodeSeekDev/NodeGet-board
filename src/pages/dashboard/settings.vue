<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import RouterViewLayout from "@/layout/components/RouterViewLayout.vue";

definePage({
  redirect: "/dashboard/settings/site",
  meta: {
    title: "router.settings",
    icon: Settings,
    order: 13,
    group: "router.group.system",
    isClosed: true,
  },
});
</script>

<template>
  <RouterViewLayout />
</template>
