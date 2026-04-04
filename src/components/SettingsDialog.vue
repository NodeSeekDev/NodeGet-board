<script setup lang="ts">
import { inject, type Ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Settings,
  Moon,
  Sun,
  Server as ServerIcon,
  Sparkles,
  Circle,
  LayoutDashboard,
  Languages,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useThemeStore } from "@/stores/theme";

const background = inject<Ref<"default" | "flickering">>("background");
const setBackground =
  inject<(val: "default" | "flickering") => void>("setBackground");
const { locale, t } = useI18n();
const themeStore = useThemeStore();

const changeLanguage = (lang: string) => {
  locale.value = lang;
  localStorage.setItem("locale", lang);
};
const toggleTheme = () => {
  themeStore.toggle();
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
        <Button
          variant="ghost"
          size="icon"
          @click="
            setBackground?.(background === 'default' ? 'flickering' : 'default')
          "
        >
          <Circle v-if="background === 'default'" class="h-4 w-4" />
          <Sparkles v-else class="h-4 w-4" />
          <span class="sr-only">{{ t("settings.background") }}</span>
        </Button>

        <Button variant="ghost" size="icon" @click="toggleTheme">
          <Moon
            v-if="!themeStore.isDark"
            class="h-[1.2rem] w-[1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
          />
          <Sun
            v-else
            class="h-[1.2rem] w-[1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
          />
          <span class="sr-only">{{ t("settings.theme") }}</span>
        </Button>

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
