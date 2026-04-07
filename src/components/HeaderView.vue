<script setup lang="ts">
import { inject } from "vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server as ServerIcon, LayoutDashboard } from "lucide-vue-next";
import SettingsDialog from "./SettingsDialog.vue";

defineProps<{
  status: "disconnected" | "connecting" | "connected";
}>();

const openBackendSwitcher = inject<() => void>("openBackendSwitcher");
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-3xl font-bold tracking-tight animate-pulse">NodeGet</h1>
    </div>
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <RouterLink :to="{ name: '/dashboard/overview' }">
        <Button variant="ghost" size="icon" title="管理后台">
          <LayoutDashboard class="h-4 w-4" />
          <span class="sr-only">管理后台</span>
        </Button>
      </RouterLink>

      <SettingsDialog />

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
