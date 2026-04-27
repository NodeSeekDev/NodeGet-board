<script setup lang="ts">
import TokenList from "@/components/token/token-list/tokenListCard.vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();

const toCreateToken = () => {
  router.push("/dashboard/tokenCeate");
};
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
      <TokenList></TokenList>
    </div>
  </div>
</template>
