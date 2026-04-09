<script setup lang="ts">
import { ref, watch } from "vue";
import { Box } from "lucide-vue-next";

const props = defineProps<{
  url: string | null;
  size?: number;
}>();

const svgContent = ref<string | null>(null);

watch(
  () => props.url,
  async (url) => {
    if (!url) {
      svgContent.value = null;
      return;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        svgContent.value = null;
        return;
      }
      const text = await resp.text();
      // 确认是 SVG 内容
      svgContent.value =
        text.trim().startsWith("<svg") || text.includes("<svg ") ? text : null;
    } catch {
      svgContent.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <span
    v-if="svgContent"
    class="flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
    :style="{ width: `${size ?? 24}px`, height: `${size ?? 24}px` }"
    v-html="svgContent"
  />
  <Box v-else :size="size ?? 16" class="text-muted-foreground" />
</template>
