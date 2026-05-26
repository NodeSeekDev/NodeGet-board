<script setup lang="ts">
import { onMounted, computed } from "vue";
// import { useAgentStatus } from "@/composables/useAgentStatus";
// import { useStaticMonitoring } from "@/composables/monitoring/useStaticMonitoring";
import { useRoute } from "vue-router";

definePage({
  redirect: (to) => `/dashboard/node/${(to.params as { uuid: string }).uuid}/status`,
  meta: {
    title: "router.node.detail",
    hidden: true,
  },
});

const route = useRoute();
const currentAgentUUID = computed(() => {
  return (route.params as { uuid: string })?.uuid;
});

// const { connect: connectDynamic } = useAgentStatus();
// const { refresh: connectStatic } = useStaticMonitoring();

// onMounted(() => {
//   connectDynamic();
//   connectStatic();
// });
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <div class="min-h-0 flex-1 overflow-hidden">
      <router-view :key="currentAgentUUID" v-if="currentAgentUUID" />
    </div>
  </div>
</template>
