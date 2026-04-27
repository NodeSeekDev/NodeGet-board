<script setup lang="ts">
import TokenEditView from "@/views/dashboard/token/TokenEditView.vue";

definePage({
  meta: {
    title: "router.tokenCreate",
    hidden: true,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <TokenEditView />
</template>
