<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import ImportTokenCard from "@/components/token/importToken/ImportTokenCard.vue";
import { Button } from "@/components/ui/button";

const router = useRouter();
const { t } = useI18n();

const handleBack = () => {
  router.push("/dashboard/token");
};
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-start gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="mt-0.5 size-9 shrink-0"
        @click="handleBack"
      >
        <ArrowLeft class="h-4 w-4" />
        <span class="sr-only">{{
          t("dashboard.token.import.returnButtonDescription")
        }}</span>
      </Button>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t("dashboard.token.import.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ t("dashboard.token.import.description") }}
        </p>
      </div>
    </div>

    <ImportTokenCard />
  </div>
</template>
