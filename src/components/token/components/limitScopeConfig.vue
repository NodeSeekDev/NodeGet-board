<script setup lang="ts">
import { onMounted, ref, useId, watch } from "vue";
import { type TokenLimitScope, type TokenLimitScopeItem } from "../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentHook } from "../useAgent";
import Button from "@/components/ui/button/Button.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import type { CheckboxCheckedState } from "reka-ui";

const props = defineProps<{
  scope: TokenLimitScope;
}>();
const emits = defineEmits<{
  (e: "update:scope", token: TokenLimitScope): void;
}>();
const useAgent = useAgentHook();

const localScope = ref<TokenLimitScope>(props.scope);
const activeTab = ref("Global");
const agentUuidList = ref<string[]>([]);
const agentUuidLoading = ref(false);
const checkboxIdPrefix = useId();

watch(
  () => props.scope,
  (value) => {
    localScope.value = value;
  },
  { immediate: true },
);

watch(
  localScope,
  (value) => {
    emits("update:scope", value);
  },
  { deep: true },
);

onMounted(() => {
  handleGetAgentList();
});

const handleGetAgentList = () => {
  agentUuidLoading.value = true;
  useAgent
    .getAgentList()
    .then((res) => {
      agentUuidList.value = res;
    })
    .finally(() => {
      agentUuidLoading.value = false;
    });
};

const handleTabChange = (value: string) => {
  console.log(value);
  if (value === "Global") {
    localScope.value = [
      {
        global: null,
      },
    ];
  } else if (value === "AgentUuid") {
    localScope.value = [
      {
        AgentUuid: [],
      },
    ];
  } else if (value === "KvNamespace") {
    localScope.value = [
      {
        KvNamespace: [],
      },
    ];
  }
};

const getFirstScopeItem = () => localScope.value[0];

const getAgentUuidScopeItem = (): Extract<
  TokenLimitScopeItem,
  { AgentUuid: string[] | null }
> => {
  const firstScopeItem = getFirstScopeItem();
  if (!firstScopeItem || !("AgentUuid" in firstScopeItem)) {
    localScope.value = [
      {
        AgentUuid: [],
      },
    ];
  }

  return localScope.value[0] as Extract<
    TokenLimitScopeItem,
    { AgentUuid: string[] | null }
  >;
};

const isAgentUuidChecked = (value: string) => {
  const scopeItem = getFirstScopeItem();
  if (!scopeItem || !("AgentUuid" in scopeItem)) {
    return false;
  }

  return (scopeItem.AgentUuid ?? []).includes(value);
};

const toggleAgentUuid = (value: string, isChecked: boolean) => {
  console.log(value, isChecked, localScope.value);
  if (activeTab.value !== "AgentUuid") {
    return;
  }

  const scopeItem = getAgentUuidScopeItem();
  const items = scopeItem.AgentUuid ?? [];

  if (isChecked) {
    if (!items.includes(value)) {
      scopeItem.AgentUuid = [...items, value];
    }
  } else {
    scopeItem.AgentUuid = items.filter((item) => item !== value);
  }

  console.log(localScope.value, value);
};

const getAgentCheckboxId = (value: string) => `${checkboxIdPrefix}-${value}`;
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2"> 作用域 </CardTitle>
    </CardHeader>

    <CardContent class="grid gap-6 space-y-6">
      <Tabs
        v-model="activeTab"
        class="w-full"
        @update:modelValue="handleTabChange"
      >
        <TabsList>
          <TabsTrigger value="Global"> 全局 </TabsTrigger>
          <TabsTrigger value="AgentUuid"> Agent </TabsTrigger>
          <TabsTrigger value="KvNamespace"> Kv </TabsTrigger>
        </TabsList>
        <TabsContent value="Global">当前是 Token 的全局作用域</TabsContent>
        <TabsContent value="AgentUuid">
          <div class="flex w-full justify-end">
            <Button @click="handleGetAgentList" :disabled="agentUuidLoading">
              <div v-if="agentUuidLoading" class="flex items-center">
                <Spinner />刷新中...
              </div>
              <div v-else>刷新 Agent</div>
            </Button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(item, index) in agentUuidList"
              :key="index"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="getAgentCheckboxId(item)"
                :checked="isAgentUuidChecked(item)"
                @update:modelValue="
                  (checked: CheckboxCheckedState) =>
                    toggleAgentUuid(item, checked === true)
                "
              />
              <Label :for="getAgentCheckboxId(item)">{{ item }}</Label>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="KvNamespace">Kv</TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
