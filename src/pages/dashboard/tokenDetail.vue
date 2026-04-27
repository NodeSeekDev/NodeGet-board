<script setup lang="ts">
import TokenDetailView from "@/views/dashboard/token/TokenDetailView.vue";

definePage({
  meta: {
    title: "router.tokenDetail",
    hidden: true,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <TokenDetailView />
</template>
