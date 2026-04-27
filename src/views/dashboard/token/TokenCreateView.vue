<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import CreateTokenCard from "@/components/token/create-token/CreateTokenCard.vue";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

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
          t("dashboard.token.create.returnButtonDescription")
        }}</span>
      </Button>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t("dashboard.token.create.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ t("dashboard.token.create.description") }}
        </p>
      </div>
    </div>
    <!-- grid gap-6 xl:grid-cols-2 -->
    <div class="">
      <CreateTokenCard />
      <!-- <DeleteTokenCard /> -->
    </div>
  </div>
</template>
