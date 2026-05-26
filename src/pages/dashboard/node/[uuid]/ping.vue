<script setup lang="ts">
import { useRoute } from "vue-router";
import PingView from "@/components/ping/PingView.vue";

definePage({
  meta: {
    title: "router.node.ping",
  },
});

const route = useRoute("/dashboard/node/[uuid]/ping");
const uuid = route.params.uuid;
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-auto rounded-md border bg-card p-6">
      <PingView :uuid="uuid" />
    </div>
  </div>
</template>
