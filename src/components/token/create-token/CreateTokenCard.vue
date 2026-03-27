<script setup lang="ts">
import { ref } from "vue";
import { type token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatTokenHook } from "../create-token/useCreateToken";
import { createDefaultToken } from "../scopeCodec";
import TokenEditorWorkspace from "../components/TokenEditorWorkspace.vue";
import TokenSuccessDialog from "../components/TokenSuccessDialog.vue";
import { useI18n } from "vue-i18n";

const createToken = useCreatTokenHook();
const { t } = useI18n();

const tokenFromData = ref<token>(createDefaultToken());
const createLoading = ref(false);
const successDialogOpen = ref(false);
const createdTokenInfo = ref({
  key: "",
  secret: "",
});

const handleTokenChange = (value: token) => {
  tokenFromData.value = value;
};

// 创建token
const handleCreateToken = () => {
  createLoading.value = true;
  createToken
    .createToken(tokenFromData.value)
    .then((result) => {
      if (result.key && result.secret) {
        createdTokenInfo.value = {
          key: result.key,
          secret: result.secret,
        };
        successDialogOpen.value = true;
      }
    })
    .finally(() => {
      createLoading.value = false;
    });
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <KeyRound class="h-5 w-5" />
        {{ t("dashboard.token.create.createTokenCard.title") }}
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6">
      <TokenEditorWorkspace
        :token="tokenFromData"
        :loading="createLoading"
        :submit-label="t('dashboard.token.create.createTokenCard.createButton')"
        :submitting-label="
          t('dashboard.token.create.createTokenCard.creatingButton')
        "
        @update:token="handleTokenChange"
        @submit="handleCreateToken"
      />
    </CardContent>
  </Card>

  <TokenSuccessDialog
    v-model:open="successDialogOpen"
    :token-key="createdTokenInfo.key"
    :token-secret="createdTokenInfo.secret"
  />
</template>
