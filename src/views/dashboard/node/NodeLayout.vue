<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useDynamicData } from "@/composables/useDynamicData";
import { useStaticData } from "@/composables/useStaticData";
import { showHostname } from "@/utils/show";

const route = useRoute();
const uuid = computed(() => route.params.uuid as string);

const { servers, connect: connectDynamic } = useDynamicData();
const { connect: connectStatic } = useStaticData();

const server = computed(() => {
  return servers.value.find((s) => s.uuid === uuid.value);
});

onMounted(() => {
  connectDynamic();
  connectStatic();
});
</script>

<template>
  <div class="h-full flex flex-col gap-2">
    <!-- Render Ping or WebShell -->
    <div class="flex-1 overflow-hidden min-h-0">
      <router-view />
    </div>
  </div>
</template>
