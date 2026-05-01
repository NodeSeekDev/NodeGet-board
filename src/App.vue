<script setup lang="ts">
import { RouterView } from "vue-router";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";
import FlickeringGrid from "@/components/ui/flickering-grid/FlickeringGrid.vue";
import { ref, provide, onMounted, watch } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { usePermissionStore } from "@/stores/permission";
import { getWsConnection } from "@/composables/useWsConnection";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const background = ref<"default" | "flickering">("default");

const setBackground = (val: "default" | "flickering") => {
  background.value = val;
  document.cookie = `background=${val}; path=/; max-age=31536000`; // 1 year
};

provide("background", background);
provide("setBackground", setBackground);

const { backends, currentBackend } = useBackendStore();
const permissionStore = usePermissionStore();

onMounted(() => {
  const bgCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("background="))
    ?.split("=")[1];
  if (bgCookie === "flickering") {
    background.value = "flickering";
  }
});
  
async function ensureBackend() {
  // Check if we need to force open backend switcher
  await router.isReady()
  
  if (backends.value.length === 0) {
    if (route.name !== "/dashboard/node-manage" || !route.query.fill)
      router.push({
        name: "/dashboard/node-manage",
        query: {
          fill: "empty",
          tab: "servers",
        },
      });
  } else if (!route.fullPath.startsWith("/dashboard/")) {
    // force pathname starts with /dashboard/
    router.replace({
      name: "/dashboard/overview",
    });
  }
}

watch(
  () => route.fullPath,
  () => {
    ensureBackend();
  },
  {
    immediate:true
  }
);

watch(
  currentBackend,
  async (backend) => {
    await permissionStore.refreshByBackend(backend);
    const tokenKey = permissionStore.tokenInfo?.token_key;
    if (backend?.url && backend?.token && tokenKey) {
      getWsConnection(backend.url)
        .call("kv_create", {
          token: backend.token,
          namespace: tokenKey,
        })
        .catch(() => {});
    }
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="fixed inset-0 z-[-1]" v-if="background === 'flickering'">
    <FlickeringGrid
      class="relative inset-0 z-0 [mask-image:radial-gradient(200px_circle_at_50%_25%,white,transparent)] md:[mask-image:radial-gradient(400px_circle_at_50%_25%,white,transparent)]"
      :square-size="4"
      :grid-gap="6"
      color="#6B7280"
      :max-opacity="0.5"
      :flicker-chance="0.1"
    />
  </div>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <Toaster rich-colors close-button theme="system" :duration="3000" />
</template>
<style scoped></style>
