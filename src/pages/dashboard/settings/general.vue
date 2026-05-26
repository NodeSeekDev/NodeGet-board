<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check } from "lucide-vue-next";
import { ColorPicker } from "vue3-colorpicker";
import "vue3-colorpicker/style.css";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useThemeStore } from "@/stores/theme";
import { useSystemSettingsStore } from "@/stores/systemSettings";
import {
  PALETTES,
  COLOR_THEME_KEYS,
  type ColorThemeName,
} from "@/theme/palettes";

definePage({
  meta: {
    title: "dashboard.settings.general",
    order: 4,
  },
});

const { t } = useI18n();
const themeStore = useThemeStore();
const systemSettingsStore = useSystemSettingsStore();

const swatches = computed(() =>
  COLOR_THEME_KEYS.filter((n) => n !== "custom").map((name) => ({
    name,
    swatch: PALETTES[name as Exclude<ColorThemeName, "custom">].swatch,
    label: name.charAt(0).toUpperCase() + name.slice(1),
  })),
);

const select = (name: ColorThemeName) => {
  themeStore.setColorTheme(name);
};

const pickerColor = ref(themeStore.customColor);
const customOpen = ref(false);

watch(
  () => themeStore.customColor,
  (val) => {
    if (val !== pickerColor.value) pickerColor.value = val;
  },
);

watch(pickerColor, (val) => {
  if (typeof val !== "string" || val === themeStore.customColor) return;
  themeStore.setCustomColor(val);
  if (themeStore.colorTheme !== "custom") themeStore.setColorTheme("custom");
});

const onCustomTriggerClick = () => {
  if (themeStore.colorTheme !== "custom") {
    themeStore.setColorTheme("custom");
  }
};
</script>

<style>
/* The picker exposes an RGBA/HEX format toggle that uses a native <select>;
   inside our popover it spills the OS dropdown outside the panel. Hide it. */
.vc-input-toggle {
  display: none !important;
}

/* Picker's black theme only restyles the root container; inner input fields
   keep a hard-coded #666 text color that's unreadable on dark backgrounds. */
.vc-colorpicker.black .vc-color-input input,
.vc-colorpicker.black .vc-rgb-input,
.vc-colorpicker.black .vc-rgb-input input,
.vc-colorpicker.black .vc-alpha-input,
.vc-colorpicker.black .vc-alpha-input input {
  color: #f5f5f5;
  background-color: rgba(255, 255, 255, 0.08);
}
</style>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold">
      {{ t("dashboard.settings.general") }}
    </h1>

    <section class="space-y-3">
      <div>
        <h2 class="text-sm font-semibold">{{ t("settings.colorTheme") }}</h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ t("settings.colorThemeDesc") }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2 max-w-xl">
        <button
          v-for="item in swatches"
          :key="item.name"
          type="button"
          :aria-pressed="themeStore.colorTheme === item.name"
          class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          :class="
            themeStore.colorTheme === item.name
              ? 'border-primary ring-1 ring-ring/40'
              : 'border-input'
          "
          @click="select(item.name)"
        >
          <span
            class="h-3 w-3 rounded-full shrink-0 ring-1 ring-border/60"
            :style="{ backgroundColor: item.swatch }"
          />
          <span>{{ item.label }}</span>
          <Check
            v-if="themeStore.colorTheme === item.name"
            class="h-3 w-3 ml-0.5 text-primary"
          />
        </button>

        <Popover v-model:open="customOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              :aria-pressed="themeStore.colorTheme === 'custom'"
              class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              :class="
                themeStore.colorTheme === 'custom'
                  ? 'border-primary ring-1 ring-ring/40'
                  : 'border-input'
              "
              @click="onCustomTriggerClick"
            >
              <span
                class="h-3 w-3 rounded-full shrink-0 ring-1 ring-border/60"
                :style="{ backgroundColor: themeStore.customColor }"
              />
              <span>{{ t("settings.customColor") }}</span>
              <Check
                v-if="themeStore.colorTheme === 'custom'"
                class="h-3 w-3 ml-0.5 text-primary"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-3" align="start">
            <ColorPicker
              v-model:pureColor="pickerColor"
              picker-type="chrome"
              shape="square"
              format="hex"
              :theme="themeStore.isDark ? 'black' : 'white'"
              :is-widget="true"
              :disable-alpha="true"
              :disable-history="true"
            />
          </PopoverContent>
        </Popover>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-sm font-semibold">RPC 调试面板</h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          控制是否记录 WebSocket RPC 调试数据。
        </p>
      </div>

      <div
        class="flex max-w-xl items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <Label for="rpc-debug-panel-switch" class="text-sm">
            RPC 调试面板
          </Label>
          <p class="text-xs leading-5 text-muted-foreground">
            开启后会处理并记录 RPC 调试数据，关闭时跳过调试数据处理。
          </p>
        </div>
        <Switch
          id="rpc-debug-panel-switch"
          v-model:modelValue="systemSettingsStore.config.rpcDebugPanelEnabled"
        />
      </div>
    </section>
  </div>
</template>
