<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { type Token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  mapTokenDetailToForm,
  useEditTokenHook,
} from "@/composables/token/useEditToken";
import { useTokenListHook } from "@/composables/token/useTokenList";
import TokenEditorWorkspace from "../components/TokenEditorWorkspace.vue";

const useEditToken = useEditTokenHook();
const useTokenList = useTokenListHook();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const tokenFromData = ref<Token>(mapTokenDetailToForm(null));
const createLoading = ref(false);
const detailLoading = ref(false);

const handleTokenChange = (value: Token) => {
  tokenFromData.value = value;
};

const getTargetToken = () => {
  const queryToken = route.query.token;
  return typeof queryToken === "string" ? queryToken.trim() : "";
};

onMounted(() => {
  getTokenDetail();
});

const getTokenDetail = async () => {
  const targetToken = getTargetToken();
  if (!targetToken) return;

  detailLoading.value = true;
  try {
    const detail = await useTokenList.getTokenDetailApi(targetToken);
    tokenFromData.value = mapTokenDetailToForm(detail);
  } catch (error) {
    console.log(error);
  } finally {
    detailLoading.value = false;
  }
};

const handleUpdateToken = async () => {
  const targetToken = getTargetToken();
  if (!targetToken) return;

  createLoading.value = true;
  try {
    await useEditToken.updateToken(tokenFromData.value, targetToken);
    router.back();
  } finally {
    createLoading.value = false;
  }
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <KeyRound class="h-5 w-5" />
        {{ t("dashboard.token.edit.editTokenCard.title") }}
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div
        v-if="detailLoading"
        class="flex min-h-[420px] flex-col items-center justify-center gap-3"
      >
        <Spinner />
        <div class="text-sm text-muted-foreground">
          {{ t("dashboard.token.edit.editTokenCard.detailLoading") }}
        </div>
      </div>

      <div v-else>
        <TokenEditorWorkspace
          :token="tokenFromData"
          :loading="createLoading"
          :disabled="detailLoading"
          :submit-label="t('dashboard.token.edit.editTokenCard.updateButton')"
          :submitting-label="
            t('dashboard.token.edit.editTokenCard.updetingButton')
          "
          @update:token="handleTokenChange"
          @submit="handleUpdateToken"
        />
      </div>
    </CardContent>
  </Card>
</template>
