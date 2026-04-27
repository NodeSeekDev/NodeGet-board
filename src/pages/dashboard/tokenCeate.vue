<script setup lang="ts">
import TokenCreateView from "@/views/dashboard/token/TokenCreateView.vue";

definePage({
  meta: {
    title: "router.tokenCreate",
    hidden: true,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <TokenCreateView />
</template>
