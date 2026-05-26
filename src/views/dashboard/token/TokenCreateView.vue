<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import CreateTokenCard from "@/components/token/create-token/CreateTokenCard.vue";
import TokenCreateModeSelect from "@/components/token/components/TokenCreateModeSelect.vue";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { createDefaultToken } from "@/components/token/scopeCodec";
import {
  createCustomToken,
  createTokenFromTemplate,
  type TokenTemplate,
} from "@/components/token/tokenTemplates.ts";
import type { Token } from "@/components/token/type";

const router = useRouter();
const { t } = useI18n();
const createStep = ref<"select" | "edit">("select");
const tokenFormData = ref<Token>(createDefaultToken());

const handleBack = () => {
  if (createStep.value === "edit") {
    createStep.value = "select";
    return;
  }

  router.push("/dashboard/token");
};

const handleStartCustomCreate = () => {
  tokenFormData.value = createCustomToken();
  createStep.value = "edit";
};

const handleUseTemplate = (template: TokenTemplate) => {
  tokenFormData.value = createTokenFromTemplate(template);
  createStep.value = "edit";
};

const handleTokenChange = (value: Token) => {
  tokenFormData.value = value;
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
    <div v-if="createStep === 'select'">
      <TokenCreateModeSelect
        @select-custom="handleStartCustomCreate"
        @select-template="handleUseTemplate"
      />
    </div>
    <div v-else>
      <CreateTokenCard
        :token="tokenFormData"
        :show-back-button="true"
        :back-label="t('dashboard.token.create.mode.backToSelect')"
        @update:token="handleTokenChange"
        @back="handleBack"
      />
    </div>
  </div>
</template>
