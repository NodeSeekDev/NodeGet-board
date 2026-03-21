<script setup lang="ts">
import { ref } from "vue";
import { type token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BaseInfoFrom from "../components/baseInfoFrom.vue";
import tokenLimitFrom from "../components/tokenLimitFrom.vue";
import PrevireToken from "../components/previewTokenJson.vue";
import { useCreatTokenHook } from "../create-token/useCreateToken";

const createToken = useCreatTokenHook();

const tokenFromData = ref<token>({
  version: 1,
  timestamp_from: 0,
  timestamp_to: 0,
  token_limit: [
    {
      scopes: [
        {
          global: null,
        },
      ],
      permissions: [],
    },
  ],
  username: "",
  password: "",
});
const createLoading = ref(false);

// 创建token
const handleCreateToken = () => {
  createLoading.value = true;
  createToken
    .createToken(tokenFromData.value)
    .then(() => {
      createLoading.value = false;
    })
    .finally(() => {
      createLoading.value = false;
    });
  console.log(tokenFromData.value);
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <KeyRound class="h-5 w-5" />
        创建token
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2">
      <div class="space-y-4">
        <BaseInfoFrom v-model:token="tokenFromData" />
        <tokenLimitFrom v-model:token="tokenFromData" />
        <Button
          @click="handleCreateToken"
          class="w-full"
          :disabled="createLoading"
        >
          <div v-if="createLoading">创建中...</div>
          <div v-else>创建token</div>
        </Button>
      </div>
      <!-- 预览区 -->
      <div>
        <PrevireToken :token="tokenFromData" />
      </div>
    </CardContent>
  </Card>
</template>
