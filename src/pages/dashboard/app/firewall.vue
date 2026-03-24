<script setup lang="ts">
import { BrickWallFire } from "lucide-vue-next";
import WorkInProcessView from "@/components/WorkInProcessPage.vue";

definePage({
  meta: {
    title: "router.firewall",
    order: 3,
    icon: BrickWallFire,
  },
});
</script>

<template>
  <WorkInProcessView />
</template>
