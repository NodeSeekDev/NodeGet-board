<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { type Token } from "../type";
import { Plus } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TokenLimitItem from "./tokenLimitItem.vue";
import { DEFAULT_SCOPE } from "../scopeCodec";

const props = defineProps<{
  token: Token;
}>();
const emits = defineEmits<{
  (e: "update:token", token: Token): void;
}>();
const { t } = useI18n();

const localToken = ref<Token>(props.token);
const defaultOpenIndex = ref<number>(0);

watch(
  () => props.token,
  (value) => {
    localToken.value = value;
    if (value.token_limit.length === 0) {
      defaultOpenIndex.value = -1;
    } else if (defaultOpenIndex.value >= value.token_limit.length) {
      defaultOpenIndex.value = 0;
    }
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
    scopes: [...DEFAULT_SCOPE],
    permissions: [],
  });
  defaultOpenIndex.value = localToken.value.token_limit.length - 1;
  emits("update:token", localToken.value);
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <!-- <KeyRound class="h-5 w-5" /> -->
        {{ t("dashboard.token.permissionsConfig.title") }}
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-2">
      <!-- <limitScopeConfig v-model:token="localToken" /> -->
      <TokenLimitItem
        v-for="(item, index) in localToken.token_limit"
        :key="index"
        :tokenLimit="item"
        :index
        :limitLength="localToken.token_limit.length"
        :defaultOpen="index === 0 || index === defaultOpenIndex"
        @update:tokenLimit="(value) => (localToken.token_limit[index] = value)"
        @delete-limit="localToken.token_limit.splice(index, 1)"
      />
      <Button class="w-full" @click="handleAddLimit">
        <Plus />
        {{ t("dashboard.token.permissionsConfig.addPermission") }}
      </Button>
    </CardContent>
  </Card>
</template>
