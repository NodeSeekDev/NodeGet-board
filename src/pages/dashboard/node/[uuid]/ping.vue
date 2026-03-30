<script setup lang="ts">
import { useRoute } from "vue-router";
import PingView from "@/components/ping/PingView.vue";

definePage({
  meta: {
    title: "router.node.ping",
  },
});

const route = useRoute();
const uuid = (route.params as { uuid: string }).uuid;
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-auto rounded-md border bg-card p-6">
      <PingView :uuid="uuid" />
    </div>
  </div>
</template>
