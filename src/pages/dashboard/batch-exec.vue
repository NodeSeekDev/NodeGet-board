<script setup lang="ts">
import { ListCheck } from "lucide-vue-next";
definePage({
  meta: {
    title: "router.batchExec",
    icon: ListCheck,
    order: 9,
    group: "router.group.tools",
  },
});

import { ref } from "vue";
import { useNodes } from "@/composables/useBatchNodes";
import { useBatchRun } from "@/composables/useBatchRun";
import { useScripts } from "@/composables/useScripts";
const { scripts, loading, add, del } = useScripts();

import type { Node } from "@/components/batch-exec/SelectNodesCard.vue";
import CodeCard from "@/components/batch-exec/CodeCard.vue";
import SelectNodesCard from "@/components/batch-exec/SelectNodesCard.vue";
import ResultCard from "@/components/batch-exec/ResultCard.vue";
import ScriptsSelectDialog from "@/components/batch-exec/widgets/ScriptsSelectDialog.vue";

const { nodes } = useNodes(["name", "tags"]);
const { run, runStatus, result } = useBatchRun();

const code = ref("");
const selected = ref<Node[]>([]);
const cmd = ref("bash");
const cmdList = ref(["bash", "sh"]);
const openSelectScriptsDialog = ref(false);

const goRun = () => {
  result.value = [];
  run(cmd.value, code.value, selected.value);
};

const handlePickScripts = (s: string) => {
  console.log(s);
  console.log(code.value);
  code.value = s;
  console.log(code.value);
};
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">{{ $t("router.batchExec") }}</h1>
    <p class="text-muted-foreground text-sm">
      {{ $t("dashboard.batchExec.desc") }}
    </p>

    <div class="grid gap-2 grid-cols-1 mt-2">
      <CodeCard
        v-model="code"
        @openScriptsSelect="openSelectScriptsDialog = true"
      />
      <SelectNodesCard
        v-model:selected="selected"
        v-model:cmd="cmd"
        :nodes="nodes as Node[]"
        :runStatus="runStatus"
        :cmdList="cmdList"
        @run="goRun()"
      />
      <ResultCard :result="result" :nodes="nodes" />
    </div>
    <ScriptsSelectDialog
      v-model:open="openSelectScriptsDialog"
      :scripts="scripts"
      @pick="handlePickScripts"
    />
  </div>
</template>
