<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useDynamicData } from "@/composables/useDynamicData";
import { showHostname } from "@/utils/show";

const route = useRoute();
const uuid = computed(() => route.params.uuid as string);

const { servers } = useDynamicData();

const server = computed(() => {
  return servers.value.find((s) => s.uuid === uuid.value);
});
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">
            {{ server ? showHostname(server) : "Node" }}
          </h2>
          <p class="text-muted-foreground font-mono text-sm">
            Node: {{ uuid }}
          </p>
        </div>
      </div>
    </div>

    <!-- Render Ping or WebShell -->
    <div class="flex-1 overflow-hidden min-h-0">
      <router-view />
    </div>
  </div>
</template>
