<script setup lang="ts">
import { ref, watch } from "vue";
import { type token } from "../type";
import { Plus } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TokenLimitItem from "./tokenLimitItem.vue";

const props = defineProps<{
  token: token;
}>();
const emits = defineEmits<{
  (e: "update:token", token: token): void;
}>();

const localToken = ref<token>(props.token);

watch(
  () => props.token,
  (value) => {
    localToken.value = value;
  },
);

watch(
  localToken,
  (value) => {
    emits("update:token", value);
  },
  { deep: true },
);

// 添加权限操作
const handleAddLimit = () => {
  localToken.value.token_limit.push({
    scopes: [
      {
        global: null,
      },
    ],
    permissions: [],
  });
  emits("update:token", localToken.value);
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <!-- <KeyRound class="h-5 w-5" /> -->
        Token权限配置
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-2">
      <!-- <limitScopeConfig v-model:token="localToken" /> -->
      <TokenLimitItem
        v-for="(item, index) in localToken.token_limit"
        :key="index"
        :index
        :limitLength="localToken.token_limit.length"
        v-model:tokenLimit="localToken.token_limit[index]"
        @delete-limit="localToken.token_limit.splice(index, 1)"
      />
      <Button class="w-full" @click="handleAddLimit"><Plus />添加权限</Button>
    </CardContent>
  </Card>
</template>
