<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { type Token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BaseInfoFrom from "../components/baseInfoFrom.vue";
import tokenLimitFrom from "../components/tokenLimitFrom.vue";
import PrevireToken from "../components/previewTokenJson.vue";
import { mapTokenDetailToForm, useEditTokenHook } from "./useEditToken";
import { useTokenListHook } from "../token-list/useTokenList";

const useEditToken = useEditTokenHook();
const useTokenList = useTokenListHook();
const route = useRoute();

const tokenFromData = ref<Token>(mapTokenDetailToForm(null));
const createLoading = ref(false);
const detailLoading = ref(false);

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
        编辑token
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2">
      <div class="space-y-4">
        <BaseInfoFrom v-model:token="tokenFromData" />
        <tokenLimitFrom v-model:token="tokenFromData" />
        <Button
          @click="handleUpdateToken"
          class="w-full"
          :disabled="createLoading || detailLoading"
        >
          <div v-if="createLoading">更新中..</div>
          <div v-else>更新token</div>
        </Button>
      </div>
      <div>
        <PrevireToken :token="tokenFromData" />
      </div>
    </CardContent>
  </Card>
</template>
