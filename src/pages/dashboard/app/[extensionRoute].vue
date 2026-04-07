<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { AlertCircle } from "lucide-vue-next";
import { useExtensions } from "@/composables/useExtensions";

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

onMounted(() => {
  if (extensions.value.length === 0) fetchExtensions();
});
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <!-- 未找到扩展 -->
    <div
      v-if="!matched"
      class="flex flex-1 items-center justify-center gap-2 text-muted-foreground"
    >
      <AlertCircle class="h-5 w-5" />
      <span>未找到扩展路由「{{ routeName }}」</span>
    </div>

    <!-- iframe 渲染 -->
    <iframe
      v-else
      :src="iframeUrl"
      class="flex-1 w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      :title="routeName"
    />
  </div>
</template>
