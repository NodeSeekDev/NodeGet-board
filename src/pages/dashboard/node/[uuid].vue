<script setup lang="ts">
import { onMounted } from "vue";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";

definePage({
  redirect: (to) =>
    `/dashboard/node/${(to.params as { uuid: string }).uuid}/status`,
  meta: {
    title: "router.node.detail",
    hidden: true,
  },
});

const { connect: connectDynamic } = useDynamicData();
const { connect: connectStatic } = useStaticData();

onMounted(() => {
  connectDynamic();
  connectStatic();
});
</script>

<template>
  <div class="h-full flex flex-col gap-2">
    <div class="flex-1 overflow-hidden min-h-0">
      <router-view />
    </div>
  </div>
</template>
