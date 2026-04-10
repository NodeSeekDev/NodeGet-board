<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import { useExtensions } from "@/composables/useExtensions";
import { useThemeStore } from "@/stores/theme";

definePage({
  meta: { title: "", hidden: true },
});

const route = useRoute();
const routeName = computed(
  () => (route.params as Record<string, string>).extensionRoute ?? "",
);

const { extensions, fetchExtensions, getIframeUrl } = useExtensions();

// 找到拥有该 global 路由名称的扩展
const matched = computed(() => {
  for (const ext of extensions.value) {
    if (ext.disabled) continue;
    const r = ext.app.routes?.find(
      (r) => r.type === "global" && r.name === routeName.value,
    );
    if (r) return { ext, route: r };
  }
  return null;
});

const iframeUrl = computed(() => {
  if (!matched.value) return "";
  const { ext, route: r } = matched.value;
  return getIframeUrl(ext.id, r.entry, ext.token);
});

const ready = ref(false);
const iframeEl = ref<HTMLIFrameElement | null>(null);
const themeStore = useThemeStore();

onMounted(async () => {
  if (extensions.value.length === 0) await fetchExtensions();
  ready.value = true;
});

watch(
  () => themeStore.isDark,
  (isDark) => {
    iframeEl.value?.contentWindow?.postMessage(
      { type: "theme-change", theme: isDark ? "dark" : "light" },
      "*",
    );
  },
);
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <div v-if="!ready" class="flex flex-1 items-center justify-center">
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
    </div>

    <div
      v-else-if="!matched"
      class="flex flex-1 items-center justify-center gap-2 text-muted-foreground"
    >
      <AlertCircle class="h-5 w-5" />
      <span>未找到扩展路由「{{ routeName }}」</span>
    </div>

    <iframe
      v-else
      ref="iframeEl"
      :src="iframeUrl"
      class="flex-1 w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      :title="routeName"
    />
  </div>
</template>
