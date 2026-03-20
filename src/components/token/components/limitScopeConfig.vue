<script setup lang="ts">
import { ref, watch } from "vue";
import { type TokenLimitScope, type TokenLimitScopeItem } from "../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const props = defineProps<{
  scope: TokenLimitScope;
}>();
const emits = defineEmits<{
  (e: "update:scope", token: TokenLimitScope): void;
}>();

const localToken = ref<TokenLimitScope>(props.scope);
const activeTab = ref("Global");

const isGlobalScope = (scope: TokenLimitScope) =>
  Array.isArray(scope) &&
  scope.some(
    (item) =>
      item != null &&
      typeof item === "object" &&
      "global" in item &&
      (item as TokenLimitScopeItem).global === null,
  );

const resolveActiveTab = (scope: TokenLimitScope) => {
  if (isGlobalScope(scope)) {
    return "Global";
  }

  if (
    Array.isArray(scope) &&
    scope.some(
      (item) => item != null && typeof item === "object" && "AgentUuid" in item,
    )
  ) {
    return "AgentUuid";
  }

  if (
    Array.isArray(scope) &&
    scope.some(
      (item) =>
        item != null && typeof item === "object" && "KvNamespace" in item,
    )
  ) {
    return "KvNamespace";
  }

  return "Global";
};

watch(
  () => props.scope,
  (value) => {
    localToken.value = value;
    activeTab.value = resolveActiveTab(value);
  },
  { immediate: true },
);

watch(
  localToken,
  (value) => {
    emits("update:scope", value);
  },
  { deep: true },
);

watch(activeTab, (value) => {
  if (value === "Global" && !isGlobalScope(localToken.value)) {
    localToken.value = [{ global: null }];
  }
});
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2"> 作用域 </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList>
          <TabsTrigger value="Global"> 全局 </TabsTrigger>
          <TabsTrigger value="AgentUuid"> Agent </TabsTrigger>
          <TabsTrigger value="KvNamespace"> Kv </TabsTrigger>
        </TabsList>
        <TabsContent value="Global">当前是Token为全局权限</TabsContent>
        <TabsContent value="AgentUuid">Agent</TabsContent>
        <TabsContent value="KvNamespace">Kv</TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
