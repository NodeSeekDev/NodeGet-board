<script setup lang="ts">
import { CreditCard } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.cost",
    icon: CreditCard,
    order: 7,
    group: "router.group.tools",
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
