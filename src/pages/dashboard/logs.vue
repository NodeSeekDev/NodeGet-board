<script setup lang="ts">
import { FileText } from "lucide-vue-next";

definePage({
  meta: {
    title: "router.logs",
    icon: FileText,
    order: 14,
    group: "router.group.system",
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("dashboard.logs") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
