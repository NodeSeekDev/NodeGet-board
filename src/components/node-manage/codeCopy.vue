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
  <div class="rounded-md border overflow-hidden relative">
    <Button
      type="button"
      @click="copyInstallScript"
      class="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 hover:border-border transition-colors"
      :title="isCopied ? 'Copied!' : 'Copy to clipboard'"
    >
      <Check v-if="isCopied" class="h-4 w-4 text-green-500" />
      <Copy v-else class="h-4 w-4 text-muted-foreground" />
    </Button>
    <Codemirror
      :model-value="code"
      :extensions="editorExtensions"
      :disabled="true"
      :style="{ minHeight: '120px' }"
    />
  </div>
</template>
