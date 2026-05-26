<script setup lang="ts">
import { Cpu, Database, HardDrive, Network } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import type { TabId } from "@/components/node/status/constants";

defineProps<{
  liveLabel: string;
  liveColor: string;
  showLive: boolean;
}>();

const activeTab = defineModel<TabId>({ required: true });

const tabs: ReadonlyArray<{ id: TabId; label: string; icon: typeof Cpu }> = [
  { id: "cpu", label: "CPU", icon: Cpu },
  { id: "memory", label: "Memory", icon: Database },
  { id: "disk", label: "Disk", icon: HardDrive },
  { id: "network", label: "Network", icon: Network },
];
</script>

<template>
  <div
    class="flex items-center gap-2 px-4 py-3 border-b shrink-0 overflow-x-auto"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="activeTab = tab.id"
      :class="[
        'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all border whitespace-nowrap',
        activeTab === tab.id
          ? 'border-border bg-muted shadow-sm font-medium'
          : 'border-transparent hover:bg-muted/50 text-muted-foreground',
      ]"
    >
      <component :is="tab.icon" class="h-4 w-4" />
      <span>{{ tab.label }}</span>
    </button>
    <div class="ml-auto shrink-0">
      <Badge
        v-if="showLive && liveLabel"
        variant="outline"
        class="font-mono text-xs"
      >
        <span
          class="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
          :style="{ backgroundColor: liveColor }"
        ></span>
        {{ liveLabel }}
      </Badge>
    </div>
  </div>
</template>
