<script setup lang="ts">
import LogsView from "@/components/logsPanel/logsView.vue";
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
  <!-- <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t('dashboard.logs') }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t('dashboard.workInProcess') }}
    </p>
  </div> -->
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ $t("dashboard.logs") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("dashboard.logsView.description") }}
        </p>
      </div>
    </div>

    <div>
      <LogsView />
    </div>
  </div>
</template>
