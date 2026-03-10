<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Radar, Terminal } from "lucide-vue-next";
import { useDynamicData } from "@/composables/useDynamicData";
import { showHostname } from "@/utils/show";

const route = useRoute();
const router = useRouter();
const uuid = computed(() => route.params.uuid as string);

const { servers } = useDynamicData();

const server = computed(() => {
  return servers.value.find((s) => s.uuid === uuid.value);
});

const goBack = () => {
  router.push("/dashboard/servers");
};

const activeTab = computed(() => {
  // Extracts the current subroute (ping or webshell)
  const pathParts = route.path.split("/");
  return pathParts[pathParts.length - 1];
});

const goToTab = (tab: string) => {
  router.push(`/dashboard/node/${uuid.value}/${tab}`);
};
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="goBack">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h2 class="text-2xl font-bold tracking-tight">
            {{ server ? showHostname(server) : "Node" }}
          </h2>
          <p class="text-muted-foreground font-mono text-sm">
            Node: {{ uuid }}
          </p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b">
        <Button
          variant="ghost"
          class="rounded-none border-b-2"
          :class="[
            activeTab === 'ping'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ]"
          @click="goToTab('ping')"
        >
          <Radar class="w-4 h-4 mr-2" />
          Ping
        </Button>
        <Button
          variant="ghost"
          class="rounded-none border-b-2"
          :class="[
            activeTab === 'webshell'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ]"
          @click="goToTab('webshell')"
        >
          <Terminal class="w-4 h-4 mr-2" />
          WebShell
        </Button>
      </div>
    </div>

    <!-- Render Ping or WebShell -->
    <div class="flex-1 overflow-hidden min-h-0">
      <router-view />
    </div>
  </div>
</template>
