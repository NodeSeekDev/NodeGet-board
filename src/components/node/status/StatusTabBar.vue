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
  <div class="flex shrink-0 items-center gap-2 overflow-x-auto border-b px-4 py-3">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="activeTab = tab.id"
      :class="[
        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-all',
        activeTab === tab.id
          ? 'border-border bg-muted font-medium shadow-sm'
          : 'hover:bg-muted/50 text-muted-foreground border-transparent',
      ]"
    >
      <component :is="tab.icon" class="h-4 w-4" />
      <span>{{ tab.label }}</span>
    </button>
    <div class="ml-auto shrink-0">
      <Badge v-if="showLive && liveLabel" variant="outline" class="font-mono text-xs">
        <span
          class="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
          :style="{ backgroundColor: liveColor }"
        ></span>
        {{ liveLabel }}
      </Badge>
    </div>
  </div>
</template>
