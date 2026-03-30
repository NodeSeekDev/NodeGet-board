<script setup lang="ts">
import { Terminal } from "lucide-vue-next";

definePage({
  meta: {
    title: "dashboard.exec",
    icon: Terminal,
    order: 10,
    group: "router.group.tools",
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.exec") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
