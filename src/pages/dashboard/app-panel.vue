<script setup lang="ts">
import { Box } from "lucide-vue-next";

definePage({
  redirect: "/dashboard/app-panel/list",
  meta: {
    title: "router.appPanel",
    icon: Box,
    order: 11,
    group: "router.group.appExtensions",
  },
});
</script>

<template>
  <router-view />
</template>
