<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Server, Plus } from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import NodeManageTabAgents from "@/components/node-manage/NodeManageTabAgents.vue";
import NodeManageTabServers from "@/components/node-manage/NodeManageTabServers.vue";
import AddAgentDialog from "@/components/agents/AddAgentDialog.vue";

definePage({
  meta: {
    title: "router.nodeManage",
    icon: Server,
    order: 2,
    group: "router.group.monitor",
  },
});

const { t } = useI18n();
const activeTab = ref("agents");
const addAgentOpen = ref(false);
const agentsRef = ref<InstanceType<typeof NodeManageTabAgents> | null>(null);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t("dashboard.nodeManage.title") }}
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t("dashboard.nodeManage.desc") }}
        </p>
      </div>
      <Button v-if="activeTab === 'agents'" @click="addAgentOpen = true">
        <Plus class="h-4 w-4 mr-1.5" />
        {{ t("dashboard.agents.addAgent") }}
      </Button>
    </div>

    <Tabs v-model="activeTab">
      <TabsList>
        <TabsTrigger value="agents">
          {{ t("dashboard.agents.title") }}
        </TabsTrigger>
        <TabsTrigger value="servers">
          {{ t("dashboard.servers.title") }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agents">
        <NodeManageTabAgents ref="agentsRef" />
      </TabsContent>
      <TabsContent value="servers">
        <NodeManageTabServers />
      </TabsContent>
    </Tabs>

    <AddAgentDialog
      v-model:open="addAgentOpen"
      @added="agentsRef?.fetchAgents()"
    />
  </div>
</template>
