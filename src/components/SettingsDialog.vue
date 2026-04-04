<script setup lang="ts">
import { inject, type Ref, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Settings, Moon, Sun, Sparkles, Circle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useThemeStore } from "@/stores/theme";

const background = inject<Ref<"default" | "flickering">>("background");
const setBackground =
  inject<(val: "default" | "flickering") => void>("setBackground");
const { locale, t } = useI18n();
const themeStore = useThemeStore();

const animatingTheme = ref(false);
const animatingBackground = ref(false);

const changeLanguage = (lang: string) => {
  locale.value = lang;
  localStorage.setItem("locale", lang);
};
const toggleTheme = () => {
  themeStore.toggle();
};

const handleThemeToggle = () => {
  animatingTheme.value = true;
  toggleTheme();
  setTimeout(() => {
    animatingTheme.value = false;
  }, 400);
};

const handleBackgroundToggle = () => {
  animatingBackground.value = true;
  setBackground?.(background?.value === "default" ? "flickering" : "default");
  setTimeout(() => {
    animatingBackground.value = false;
  }, 400);
};
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button variant="ghost" size="icon">
        <Settings class="h-4 w-4" />
        <span class="sr-only">Settings</span>
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{{ t("dashboard.settings.general") }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-6 pt-4">
        <!-- Background Toggle -->
        <div class="space-y-2">
          <Label>{{ t("settings.background") }}</Label>
          <Button
            variant="outline"
            class="w-full justify-start gap-3 h-12 transition-all duration-300"
            :class="[animatingBackground && 'scale-[1.02]']"
            @click="handleBackgroundToggle"
          >
            <Circle
              v-if="background === 'default'"
              class="h-5 w-5"
              :class="{ 'animate-pop-once': animatingBackground }"
            />
            <Sparkles
              v-else
              class="h-5 w-5 text-amber-500"
              :class="{ 'animate-pop-once': animatingBackground }"
            />
            <span class="font-medium">{{ background }}</span>
          </Button>
        </div>

        <!-- Theme Toggle -->
        <div class="space-y-2">
          <Label>{{ t("settings.theme") }}</Label>
          <Button
            variant="outline"
            class="w-full justify-start gap-3 h-12 transition-all duration-300"
            :class="[animatingTheme && 'scale-[1.02]']"
            @click="handleThemeToggle"
          >
            <Moon
              v-if="themeStore.isDark"
              class="h-5 w-5 text-blue-700"
              :class="{ 'animate-spin-once': animatingTheme }"
            />
            <Sun
              v-else
              class="h-5 w-5 text-orange-600"
              :class="{ 'animate-spin-once': animatingTheme }"
            />
            <span class="font-medium">{{
              themeStore.isDark ? "Dark" : "Light"
            }}</span>
          </Button>
        </div>

        <Separator />

        <!-- Language Toggle -->
        <div class="space-y-3">
          <Label>{{ t("settings.language") }}</Label>
          <div class="flex gap-2">
            <Button
              :variant="locale === 'en' ? 'default' : 'outline'"
              size="sm"
              @click="changeLanguage('en')"
            >
              English
            </Button>
            <Button
              :variant="locale === 'zh_cn' ? 'default' : 'outline'"
              size="sm"
              @click="changeLanguage('zh_cn')"
            >
              中文简体
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
@keyframes spin-once {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes pop-once {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
.animate-spin-once {
  animation: spin-once 0.5s ease-in-out;
}
.animate-pop-once {
  animation: pop-once 0.4s ease-in-out;
}
</style>
