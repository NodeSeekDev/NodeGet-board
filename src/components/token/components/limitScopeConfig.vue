<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { type TokenLimitScope } from "../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentHook } from "../useAgent";
import Button from "@/components/ui/button/Button.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import type { CheckboxCheckedState } from "reka-ui";
import { DEFAULT_SCOPE } from "../scopeCodec";
import {
  detectScopeTab,
  getSelectedAgentUuids,
  type ScopeTabValue,
} from "../scopeUi";

const props = defineProps<{
  scope: TokenLimitScope;
}>();
const emits = defineEmits<{
  (e: "update:scope", token: TokenLimitScope): void;
}>();
const useAgent = useAgentHook();

const localScope = ref<TokenLimitScope>(props.scope);
const activeTab = ref<ScopeTabValue>(detectScopeTab(props.scope));
const agentUuidList = ref<string[]>([]);
const agentUuidLoading = ref(false);
const checkboxIdPrefix = useId();

watch(
  () => props.scope,
  (value) => {
    localScope.value = value;
    activeTab.value = detectScopeTab(value, activeTab.value);
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
  if (value === "Global") {
    localScope.value = [...DEFAULT_SCOPE];
    return;
  }

  localScope.value = [];
};

const selectedAgentUuids = computed(() =>
  getSelectedAgentUuids(localScope.value),
);

const isAgentUuidChecked = (value: string) => {
  console.log(value, selectedAgentUuids.value.includes(value), "=====");
  return selectedAgentUuids.value.includes(value);
};

const toggleAgentUuid = (value: string, isChecked: boolean) => {
  if (activeTab.value !== "AgentUuid") {
    return;
  }

  if (isChecked) {
    if (!selectedAgentUuids.value.includes(value)) {
      localScope.value = [...localScope.value, { agent_uuid: value }];
    }
    return;
  }

  localScope.value = localScope.value.filter(
    (item) => !("agent_uuid" in item) || item.agent_uuid !== value,
  );
};

const getAgentCheckboxId = (value: string) => `${checkboxIdPrefix}-${value}`;
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">作用域</CardTitle>
    </CardHeader>

    <CardContent class="grid gap-6 space-y-6">
      <Tabs
        v-model="activeTab"
        class="w-full"
        @update:modelValue="handleTabChange"
      >
        <TabsList>
          <TabsTrigger value="Global">全局</TabsTrigger>
          <TabsTrigger value="AgentUuid">Agent</TabsTrigger>
          <TabsTrigger value="KvNamespace">Kv</TabsTrigger>
        </TabsList>
        <TabsContent value="Global"> 当前为 Token 的全局作用域 </TabsContent>
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
                :modelValue="isAgentUuidChecked(item)"
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
