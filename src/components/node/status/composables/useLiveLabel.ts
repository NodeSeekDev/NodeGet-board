import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import type { Ref } from "vue";

export function useLiveLabel(source: Ref<unknown>) {
  const lastUpdate = ref(0);
  const elapsed = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  watch(source, (s) => {
    if (s) lastUpdate.value = Date.now();
  });

  onMounted(() => {
    timer = setInterval(() => {
      elapsed.value = lastUpdate.value
        ? Date.now() - lastUpdate.value
        : Infinity;
    }, 1000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  const label = computed(() => {
    if (!lastUpdate.value) return "";
    const secs = Math.floor(elapsed.value / 1000);
    if (secs <= 2) return "Live";
    return `Updated ${secs}s ago`;
  });

  const color = computed(() => {
    if (!lastUpdate.value) return "";
    const secs = Math.floor(elapsed.value / 1000);
    return secs <= 2 ? "#22c55e" : "#eab308";
  });

  return reactive({ label, color });
}
