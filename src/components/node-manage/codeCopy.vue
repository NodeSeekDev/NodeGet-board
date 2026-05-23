<script setup lang="ts">
import { ref, computed } from "vue";
import { Codemirror } from "vue-codemirror";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { StreamLanguage } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-vue-next";

const props = defineProps<{
  code: string;
}>();

const themeStore = useThemeStore();

const isCopied = ref(false);
const copyInstallScript = async () => {
  try {
    await navigator.clipboard.writeText(props.code);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (e) {
    console.error("Failed to copy:", e);
  }
};

const editorExtensions = computed(() => [
  StreamLanguage.define(shell),
  ...(themeStore.isDark ? [oneDark] : []),
]);
</script>
<template>
  <div class="relative overflow-hidden rounded-md border">
    <Button
      type="button"
      @click="copyInstallScript"
      class="bg-background/80 hover:bg-background border-border/50 hover:border-border absolute top-2 right-2 z-10 rounded-md border p-1.5 transition-colors"
      :title="isCopied ? 'Copied!' : 'Copy to clipboard'"
    >
      <Check v-if="isCopied" class="h-4 w-4 text-green-500" />
      <Copy v-else class="text-muted-foreground h-4 w-4" />
    </Button>
    <Codemirror
      :model-value="code"
      :extensions="editorExtensions"
      :disabled="true"
      :style="{ minHeight: '120px' }"
    />
  </div>
</template>
