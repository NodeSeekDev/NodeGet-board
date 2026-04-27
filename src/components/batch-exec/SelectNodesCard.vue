<script setup lang="ts">
import { computed } from "vue";
import { Server } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import SelectNodes from "@/components/batch-exec/widgets/SelectNodes.vue";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Node {
  uuid: string;
  name: string;
  tags: string[];
}

const props = defineProps<{
  nodes: Node[];
  selected: Node[];
  runStatus: boolean;
  cmd: string;
  cmdList: string[];
}>();

// Emits
const emit = defineEmits<{
  (e: "update:selected", val: Node[]): void;
  (e: "update:cmd", val: string): void;
  (e: "run"): void;
}>();

const cmdProxy = computed({
  get: () => props.cmd ?? "",
  set: (val: string) => emit("update:cmd", val),
});

const selectedProxy = computed({
  get: () => props.selected ?? [],
  set: (val: Node[]) => emit("update:selected", val),
});
</script>

<template>
  <Card class="relative">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Server class="h-5 w-5" />
        {{ $t("dashboard.batchExec.selectNode") }}
      </CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col items-end space-y-4">
      <SelectNodes
        :nodes="nodes"
        v-model:selected="selectedProxy"
        class="w-full"
      />
      <div class="w-full flex flex-col gap-1 items-end md:flex-row">
        <div class="text-gray-400 text-xs text-right w-full md:text-left">
          {{
            $t("dashboard.batchExec.totalNodesCount", {
              count: selected.length,
            })
          }}
        </div>
        <div
          class="w-full flex flex-col gap-1 flex-col md:flex-row justify-end md:items-end"
        >
          <div class="text-gray-400 text-xs">
            {{ $t("dashboard.batchExec.cmd") }}
          </div>
          <div class="w-full md:w-30">
            <Select v-model="cmdProxy">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in cmdList" :value="item">{{
                  item
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            class="w-full md:w-auto"
            :disabled="runStatus"
            @click="$emit('run')"
          >
            {{
              runStatus
                ? $t("dashboard.batchExec.running")
                : $t("dashboard.batchExec.run")
            }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
