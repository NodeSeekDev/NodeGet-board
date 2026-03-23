<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { type TokenLimitScope } from "../type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentHook } from "../useAgent";
import { useKvHook } from "../useKv";
import Button from "@/components/ui/button/Button.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import type { CheckboxCheckedState } from "reka-ui";
import { DEFAULT_SCOPE } from "../scopeCodec";
import {
  detectScopeTab,
  getSelectedAgentUuids,
  getSelectedKvNamespaces,
  type ScopeTabValue,
} from "../scopeUi";

const props = defineProps<{
  scope: TokenLimitScope;
  scopeTab?: ScopeTabValue;
}>();
const emits = defineEmits<{
  (e: "update:scope", token: TokenLimitScope): void;
  (e: "update:scopeTab", value: ScopeTabValue): void;
}>();
const useAgent = useAgentHook();
const useKv = useKvHook();

const localScope = ref<TokenLimitScope>(props.scope);
const activeTab = ref<ScopeTabValue>(
  props.scopeTab ?? detectScopeTab(props.scope),
);
const agentUuidList = ref<string[]>([]);
const agentUuidLoading = ref(false);
const agentUuidLoaded = ref(false);
const kvNamespaceList = ref<string[]>([]);
const kvNamespaceLoading = ref(false);
const kvNamespaceLoaded = ref(false);
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
  () => props.scopeTab,
  (value) => {
    if (!value || value === activeTab.value) {
      return;
    }
    activeTab.value = value;
  },
);

watch(
  localScope,
  (value) => {
    emits("update:scope", value);
  },
  { deep: true },
);

watch(activeTab, (value) => {
  emits("update:scopeTab", value);
});

// 获取agentList
const handleGetAgentList = () => {
  if (agentUuidLoading.value) {
    return;
  }

  agentUuidLoading.value = true;
  useAgent
    .getAgentList()
    .then((res) => {
      agentUuidList.value = res;
      agentUuidLoaded.value = true;
    })
    .finally(() => {
      agentUuidLoading.value = false;
    });
};

//获取kvList
const handleGetKvList = () => {
  if (kvNamespaceLoading.value) {
    return;
  }

  kvNamespaceLoading.value = true;
  useKv
    .getKvList()
    .then((res) => {
      kvNamespaceList.value = res;
      kvNamespaceLoaded.value = true;
    })
    .finally(() => {
      kvNamespaceLoading.value = false;
    });
};

watch(
  activeTab,
  (value) => {
    // if (value !== 'AgentUuid' || agentUuidLoaded.value) {
    //   return;
    // }
    // handleGetAgentList();
    if (value === "AgentUuid" && !agentUuidLoaded.value) {
      handleGetAgentList();
    } else if (value === "KvNamespace" && !kvNamespaceLoaded.value) {
      handleGetKvList();
    }
    return;
  },
  { immediate: true },
);

const handleTabChange = (value: string) => {
  if (value === "Global") {
    localScope.value = [...DEFAULT_SCOPE];
    return;
  }

  const nextTab = value as ScopeTabValue;
  const currentScopeTab = detectScopeTab(localScope.value, activeTab.value);

  if (currentScopeTab !== nextTab) {
    localScope.value = [];
  }
};

const selectedAgentUuids = computed(() =>
  getSelectedAgentUuids(localScope.value),
);

const selectedKvNamespaces = computed(() =>
  getSelectedKvNamespaces(localScope.value),
);

const isAgentUuidChecked = (value: string) =>
  selectedAgentUuids.value.includes(value);

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

const isKvNamespaceChecked = (value: string) =>
  selectedKvNamespaces.value.includes(value);

const toggleKvNamespace = (value: string, isChecked: boolean) => {
  if (activeTab.value !== "KvNamespace") {
    return;
  }

  if (isChecked) {
    if (!selectedKvNamespaces.value.includes(value)) {
      localScope.value = [...localScope.value, { kv_namespace: value }];
    }
    return;
  }

  localScope.value = localScope.value.filter(
    (item) => !("kv_namespace" in item) || item.kv_namespace !== value,
  );
};

const getCheckboxId = (value: string) => `${checkboxIdPrefix}-${value}`;
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
        <TabsContent value="AgentUuid" class="space-y-1">
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
                :id="getCheckboxId(item)"
                :modelValue="isAgentUuidChecked(item)"
                @update:modelValue="
                  (checked: CheckboxCheckedState) =>
                    toggleAgentUuid(item, checked === true)
                "
              />
              <Label :for="getCheckboxId(item)">{{ item }}</Label>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="KvNamespace" class="space-y-1">
          <div class="flex w-full justify-end">
            <Button @click="handleGetKvList" :disabled="kvNamespaceLoading">
              <div v-if="kvNamespaceLoading" class="flex items-center">
                <Spinner />刷新中...
              </div>
              <div v-else>刷新 Kv</div>
            </Button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(item, index) in kvNamespaceList"
              :key="index"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="getCheckboxId(item)"
                :modelValue="isKvNamespaceChecked(item)"
                @update:modelValue="
                  (checked: CheckboxCheckedState) =>
                    toggleKvNamespace(item, checked === true)
                "
              />
              <Label :for="getCheckboxId(item)">{{ item }}</Label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
