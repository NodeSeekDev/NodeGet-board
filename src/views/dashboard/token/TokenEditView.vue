<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ArrowLeft } from "lucide-vue-next";
import EditTokenCard from "@/components/token/editToken/editTokenCard.vue";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";

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
          t("dashboard.token.edit.returnButtonDescription")
        }}</span>
      </Button>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t("dashboard.token.edit.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ t("dashboard.token.edit.description") }}
        </p>
      </div>
    </div>
    <div class="">
      <EditTokenCard />
    </div>
  </div>
</template>
