<script setup lang="ts">
import DetailTokenCard from "@/components/token/detailToken/detailTokenCard.vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        {{ t("dashboard.token.detail.title") }}
      </h2>
      <p class="text-muted-foreground">
        {{ t("dashboard.token.detail.description") }}
      </p>
    </div>
    <DetailTokenCard />
  </div>
</template>
