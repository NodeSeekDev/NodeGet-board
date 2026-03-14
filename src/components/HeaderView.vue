<script setup lang="ts">
import { ref, onMounted, inject, type Ref } from "vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  Server as ServerIcon,
  Sparkles,
  Circle,
  LayoutDashboard,
  Languages,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "vue-i18n";

defineProps<{
  status: "disconnected" | "connecting" | "connected";
}>();

const isDark = ref(false);
const background = inject<Ref<"default" | "flickering">>("background");
const setBackground =
  inject<(val: "default" | "flickering") => void>("setBackground");
const openBackendSwitcher = inject<() => void>("openBackendSwitcher");
const { locale } = useI18n();

const changeLanguage = (lang: string) => {
  locale.value = lang;
  localStorage.setItem("locale", lang);
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add("dark");
    document.cookie = "theme=dark; path=/; max-age=31536000"; // 1 year
  } else {
    document.documentElement.classList.remove("dark");
    document.cookie = "theme=light; path=/; max-age=31536000"; // 1 year
  }
};

onMounted(() => {
  const themeCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("theme="))
    ?.split("=")[1];
  if (themeCookie === "dark") {
    isDark.value = true;
    document.documentElement.classList.add("dark");
  } else {
    isDark.value = false;
    document.documentElement.classList.remove("dark");
  }
});
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-3xl font-bold tracking-tight animate-pulse">NodeGet</h1>
    </div>
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <RouterLink to="/dashboard/overview">
        <Button variant="ghost" size="icon" title="管理后台">
          <LayoutDashboard class="h-4 w-4" />
          <span class="sr-only">管理后台</span>
        </Button>
      </RouterLink>

      <Button
        variant="ghost"
        size="icon"
        @click="
          setBackground?.(background === 'default' ? 'flickering' : 'default')
        "
        title="Toggle background"
      >
        <Circle v-if="background === 'default'" class="h-4 w-4" />
        <Sparkles v-else class="h-4 w-4" />
        <span class="sr-only">Toggle background</span>
      </Button>

      <Button variant="ghost" size="icon" @click="toggleTheme">
        <Moon
          v-if="!isDark"
          class="h-[1.2rem] w-[1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Sun
          v-else
          class="h-[1.2rem] w-[1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
        <span class="sr-only">Toggle theme</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon">
            <Languages class="h-[1.2rem] w-[1rem]" />
            <span class="sr-only">Toggle language</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="changeLanguage('en')">
            English
          </DropdownMenuItem>
          <DropdownMenuItem @click="changeLanguage('zh_cn')">
            中文简体
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" @click="openBackendSwitcher?.()">
        <ServerIcon class="h-4 w-4" />
        <span class="sr-only">Switch backend</span>
      </Button>
      <Badge
        :variant="
          status === 'connected'
            ? 'default'
            : status === 'connecting'
              ? 'secondary'
              : 'destructive'
        "
      >
        {{
          status === "connected"
            ? "Online"
            : status === "connecting"
              ? "Connecting..."
              : "Offline"
        }}
      </Badge>
    </div>
  </div>
</template>
