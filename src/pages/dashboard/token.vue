<script setup lang="ts">
import { Key } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import TokenList from "@/components/token/token-list/tokenListCard.vue";

const { t } = useI18n();

definePage({
  meta: {
    title: "router.token",
    icon: Key,
    order: 8,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t("dashboard.token.list.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ t("dashboard.token.list.description") }}
        </p>
      </div>
    </div>

    <div>
      <TokenList />
    </div>
  </div>
</template>
