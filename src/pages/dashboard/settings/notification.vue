<script setup lang="ts">
definePage({
  meta: {
    title: "router.notification",
    order: 3,
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">
      {{ $t("dashboard.settings.notification") }}
    </h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.workInProcess") }}
    </p>
  </div>
</template>
