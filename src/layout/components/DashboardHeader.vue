<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ArrowLeft, Menu, Moon, Sun } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/theme";
import SettingsDialog from "@/components/SettingsDialog.vue";
import { useRoute, useRouter } from "vue-router";
import { watch, computed, onMounted } from "vue";
import { useStaticMonitoring } from "@/composables/monitoring/useStaticMonitoring";
import { useAgentInfo } from "@/composables/useAgentInfo";
import { Router, CircleQuestionMark } from "lucide-vue-next";
import Separator from "@/components/ui/separator/Separator.vue";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  showHostname,
  showOS,
  showCpuPercent,
  showRamPercent,
  showRamText,
  showNetworkSpeed,
  showDiskUsage,
  showDiskPercent,
  showDiskDisplay,
  distroLogo,
  virtLabel,
  flagUrl,
} from "@/utils/show";

const router = useRouter();
const route = useRoute();
const { agents, fetchAgents } = useAgentInfo();

const emit = defineEmits<{
  openMobileSidebar: [];
}>();

const themeStore = useThemeStore();

const { servers, loading, refresh } = useStaticMonitoring();

const isAgentPanel = computed(() => {
  return (
    route.fullPath.startsWith("/dashboard/node/") &&
    typeof (route.params as { uuid: string }).uuid === "string"
  );
});

const currentAgent = computed(() => {
  if (!isAgentPanel.value) {
    return null;
  }
  const info = agents.value.find(
    (v) => v.uuid === (route.params as { uuid: string }).uuid,
  );
  const staticData = servers.value.find(
    (v) => v.uuid === (route.params as { uuid: string }).uuid,
  );
  return {
    info,
    staticData,
  };
});

function selectAgent(uuid: string) {
  const part = route.fullPath.split("/").filter((v) => !!v);
  const subPath = part[part.length - 1];
  router.push(`/dashboard/node/${uuid}/${subPath}`);
}

async function init() {
  fetchAgents();
  refresh();
}

watch(isAgentPanel, init, {
  immediate: true,
  deep: true,
});

onMounted(init);
</script>

<template>
  <header class="flex h-14 shrink-0 items-center border-b px-4 gap-3">
    <Button
      variant="ghost"
      size="icon"
      class="md:hidden shrink-0"
      @click="emit('openMobileSidebar')"
    >
      <Menu class="h-5 w-5" />
    </Button>
    <div v-if="isAgentPanel && currentAgent" class="ml-2 opacity-60">
      <div class="flex h-5 items-center space-x-4 text-sm">
        <div
          class="flex gap-1"
          v-if="agents.length && (route.params as { uuid: string }).uuid"
        >
          <Select
            :model-value="(route.params as { uuid: string }).uuid"
            @update:model-value="(v) => selectAgent(v as string)"
          >
            <SelectTrigger class="w-[160px] flex gap-1 items-center">
              <template v-if="currentAgent.info?.metadata?.region">
                <img
                  v-if="flagUrl(currentAgent.info?.metadata?.region)"
                  :src="flagUrl(currentAgent.info?.metadata?.region)"
                  :alt="currentAgent.info?.metadata?.region"
                  :title="currentAgent.info?.metadata?.region"
                  loading="lazy"
                  class="inline-block w-5 h-3.5 rounded-[1px] object-cover shadow-sm mr-1"
                />
              </template>
              <CircleQuestionMark
                v-else
                class="inline-block w-5 h-3.5 rounded-[1px] object-cover mx-1"
              />
              <SelectValue placeholder="切换被控节点" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup class="px-1.5">
                <SelectLabel>被控节点</SelectLabel>
                <SelectItem
                  :value="ag.uuid"
                  v-for="ag in agents"
                  class="flex gap-1 items-center"
                >
                  <!-- <Router class="h-4 w-4 mr-1" /> -->
                  <template v-if="ag?.metadata?.region">
                    <img
                      v-if="flagUrl(ag?.metadata?.region)"
                      :src="flagUrl(ag?.metadata?.region)"
                      :alt="ag?.metadata?.region"
                      :title="ag?.metadata?.region"
                      loading="lazy"
                      class="inline-block w-5 h-3.5 rounded-[1px] object-cover shadow-sm mr-1"
                    />
                  </template>
                  <CircleQuestionMark
                    v-else
                    class="inline-block w-8 h-3.5 rounded-[1px] object-cover mx-1"
                  />
                  {{ ag.metadata?.customName }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <!-- <template v-if="currentAgent.staticData?.system?.system_name">
          <Separator orientation="vertical" />
          <img v-if="distroLogo(currentAgent.staticData)" :src="distroLogo(currentAgent.staticData)" alt=""
            class="w-5 h-5 shrink-0 object-contain" loading="lazy" />
        </template>

        <template v-if="currentAgent.info?.metadata?.region">
          <Separator orientation="vertical" />
          <img v-if="flagUrl(currentAgent.info?.metadata?.region)" :src="flagUrl(currentAgent.info?.metadata?.region)"
            :alt="currentAgent.info?.metadata?.region" :title="currentAgent.info?.metadata?.region" loading="lazy"
            class="inline-block w-5 h-3.5 rounded-[1px] object-cover shadow-sm" />
        </template> -->
      </div>
    </div>
    <div class="ml-auto">
      <SettingsDialog />
      <!-- <RouterLink :to="{ name: '/' }"> -->
      <Button variant="ghost" size="sm" @click="() => router.back()">
        <ArrowLeft class="h-4 w-4 mr-1" />
        返回
      </Button>
      <!-- </RouterLink> -->
    </div>
  </header>
</template>
