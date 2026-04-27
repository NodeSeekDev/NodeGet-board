<script setup lang="ts">
import TokenImportView from "@/views/dashboard/token/TokenImportView.vue";

definePage({
  meta: {
    title: "router.tokenImport",
    hidden: true,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <TokenImportView />
</template>
