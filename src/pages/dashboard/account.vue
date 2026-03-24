<script setup lang="ts">
import { User } from "lucide-vue-next";

definePage({
  meta: {
    title: "dashboard.account",
    icon: User,
    order: 15,
    group: "router.group.system",
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.account") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
