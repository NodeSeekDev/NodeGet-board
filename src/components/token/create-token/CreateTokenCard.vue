<script setup lang="ts">
import { computed, ref } from "vue";
import { type token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatTokenHook } from "@/composables/token/useCreateToken";
import TokenEditorWorkspace from "../components/TokenEditorWorkspace.vue";
import TokenSuccessDialog from "../components/TokenSuccessDialog.vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    token: token;
    showBackButton?: boolean;
    backLabel?: string;
  }>(),
  {
    showBackButton: false,
    backLabel: "",
  },
);

const emits = defineEmits<{
  (e: "update:token", value: token): void;
  (e: "back"): void;
}>();

const createToken = useCreatTokenHook();
const { t } = useI18n();

const createLoading = ref(false);
const successDialogOpen = ref(false);
const createdTokenInfo = ref({
  key: "",
  secret: "",
});

const tokenFromData = computed({
  get: () => props.token,
  set: (value: token) => emits("update:token", value),
});

const handleTokenChange = (value: token) => {
  emits("update:token", value);
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
        :show-back-button="props.showBackButton"
        :back-label="props.backLabel"
        @update:token="handleTokenChange"
        @back="emits('back')"
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
