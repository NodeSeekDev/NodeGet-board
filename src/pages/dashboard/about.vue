<script setup lang="ts">
import { Info } from "lucide-vue-next";

definePage({
  meta: {
    title: "router.about",
    icon: Info,
    order: 16,
    group: "router.group.system",
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.about") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
