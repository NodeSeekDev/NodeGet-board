<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NodeSettingTabBasic from "@/components/node/setting/NodeSettingTabBasic.vue";
import NodeSettingTabConfig from "@/components/node/setting/NodeSettingTabConfig.vue";
import NodeSettingTabStorage from "@/components/node/setting/NodeSettingTabStorage.vue";
import NodeSettingTabDelete from "@/components/node/setting/NodeSettingTabDelete.vue";
import NodeSettingTabUpstream from "@/components/node/setting/NodeSettingTabUpstream.vue";

definePage({
  meta: {
    title: "router.node.setting",
  },
});

const route = useRoute();
const uuid = (route.params as { uuid: string }).uuid;
const activeTab = ref("basic");
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-auto rounded-md border bg-card p-6">
      <div class="mb-6">
        <h2 class="text-lg font-semibold">
          {{ $t("dashboard.node.settingsTitle") }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t("dashboard.node.settingsDesc") }}
        </p>
      </div>

      <Tabs v-model="activeTab" class="space-y-6">
        <TabsList>
          <TabsTrigger value="basic">
            {{ $t("dashboard.node.tabBasic") }}
          </TabsTrigger>
          <TabsTrigger value="config">
            {{ $t("dashboard.node.tabConfig") }}
          </TabsTrigger>
          <TabsTrigger value="upstream">
            {{ $t("dashboard.node.upstream") }}
          </TabsTrigger>
          <TabsTrigger value="storage">
            {{ $t("dashboard.node.tabStorage") }}
          </TabsTrigger>
          <TabsTrigger value="delete">
            {{ $t("dashboard.node.tabDelete") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <NodeSettingTabBasic :uuid="uuid" />
        </TabsContent>
        <TabsContent value="config">
          <NodeSettingTabConfig :uuid="uuid" />
        </TabsContent>
        <TabsContent value="upstream">
          <NodeSettingTabUpstream :uuid="uuid" />
        </TabsContent>
        <TabsContent value="storage">
          <NodeSettingTabStorage :uuid="uuid" />
        </TabsContent>
        <TabsContent value="delete">
          <NodeSettingTabDelete :uuid="uuid" />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
