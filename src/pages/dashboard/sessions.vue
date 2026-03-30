<script setup lang="ts">
import { Users } from "lucide-vue-next";

definePage({
  meta: {
    title: "dashboard.sessions",
    icon: Users,
    order: 11,
    group: "router.group.tools",
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.sessions") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
