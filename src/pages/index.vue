<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import Loader from "@/components/misc/loader.vue";
import loader2 from "@/components/misc/loader2.vue";
import { useBackendStore } from "@/composables/useBackendStore";
import Loader2 from "@/components/misc/loader2.vue";

const router = useRouter();
const { backends } = useBackendStore();

onMounted(async () => {
  await router.isReady();

  if (backends.value.length === 0) {
    await router.replace({
      name: "/dashboard/node-manage",
      query: {
        fill: "empty",
        tab: "servers",
      },
    });
    return;
  }

  await router.replace({ name: "/dashboard/overview" });
});
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <Loader />
  </div>
</template>
