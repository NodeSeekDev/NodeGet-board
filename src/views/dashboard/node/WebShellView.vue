<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import WebTerminal from "@/components/WebTerminal.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { Card, CardContent } from "@/components/ui/card";

const route = useRoute();
const uuid = route.params.uuid as string;

const { currentBackend } = useBackendStore();

const webshellReady = computed(() => {
  return Boolean(
    currentBackend.value?.url && currentBackend.value?.token && uuid,
  );
});
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 rounded-md overflow-hidden">
      <WebTerminal
        v-if="webshellReady"
        :rpc-url="currentBackend?.url || ''"
        :token="currentBackend?.token || ''"
        :target-uuid="uuid"
        class="h-full"
      />
      <Card v-else>
        <CardContent class="py-6 text-sm text-muted-foreground">
          Current backend config is incomplete, unable to create a WebShell
          task.
        </CardContent>
      </Card>
    </div>
  </div>
</template>
