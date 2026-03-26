import { defineStore } from "pinia";
import { ref } from "vue";
import { applyTheme, initTheme } from "@/theme/dom";

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false);

  const init = () => {
    isDark.value = initTheme();
  };

  const setTheme = (dark: boolean) => {
    isDark.value = dark;
    applyTheme(dark);
  };

  const toggle = () => {
    setTheme(!isDark.value);
  };

  return { isDark, init, setTheme, toggle };
});
