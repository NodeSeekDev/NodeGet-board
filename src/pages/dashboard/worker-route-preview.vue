<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ChevronLeft, ExternalLink } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useJsRuntime } from "@/composables/useJsRuntime";

definePage({
  meta: {
    title: "router.jsRuntimePreview",
    hidden: true,
  },
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const runtime = useJsRuntime();

const routeName = computed(() => (route.query.route as string) || "");

const httpBaseUrl = computed(() => {
  let url = runtime.backendUrl.value || "";
  url = url.replace(/^ws/, "http");
  if (url.endsWith("/ws")) url = url.slice(0, -3);
  if (url.endsWith("/ws/")) url = url.slice(0, -4);
  return url;
});

const previewUrl = computed(() => {
  if (!routeName.value) return "";
  return `${httpBaseUrl.value}/worker-route/${routeName.value}`;
});

const goBack = () => {
  router.push("/dashboard/js-runtime");
};

const openInNewWindow = () => {
  if (previewUrl.value) {
    window.open(previewUrl.value, "_blank");
  }
};
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-100px)] space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="goBack">
          <ChevronLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-semibold flex items-center gap-2">
            {{ t("dashboard.jsRuntime.previewTitle") }}
          </h1>
          <p class="text-muted-foreground font-mono text-sm">
            {{ routeName || "No Route Selected" }}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        @click="openInNewWindow"
        :disabled="!previewUrl"
      >
        <ExternalLink class="h-4 w-4 mr-2" />
        {{ t("common.openInNewWindow", "在新窗口打开") }}
      </Button>
    </div>

    <div
      class="flex-1 bg-muted rounded-xl border overflow-hidden relative group"
    >
      <iframe
        v-if="previewUrl"
        :src="previewUrl"
        class="w-full h-full border-0 bg-white"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      ></iframe>
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-muted-foreground"
      >
        {{ t("dashboard.jsRuntime.noRoute", "未绑定路由") }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the iframe container takes up available space */
.bg-muted {
  min-height: 400px;
}
</style>
