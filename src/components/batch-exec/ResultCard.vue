<script setup lang="ts">
import { ref } from "vue";
import ExecResultCard from "@/components/batch-exec/widgets/ExecResult.vue";
import { CheckCircle, ChevronsDownUp } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

defineProps<{ result: any[]; nodes: any[] }>();

const expandedAll = ref(false);

const toggleExpandAll = () => {
  expandedAll.value = !expandedAll.value;
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <CheckCircle class="h-5 w-5" />{{ $t("dashboard.batchExec.results") }}
        </div>
        <div
          class="cursor-pointer"
          :title="$t('dashboard.batchExec.expandResults')"
          @click="toggleExpandAll"
        >
          <ChevronsDownUp
            class="h-5 w-5 transition-transform duration-200"
            :class="{ 'rotate-180': expandedAll }"
          />
        </div>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ExecResultCard
        :result="result"
        :nodes="nodes"
        :expanded-all="expandedAll"
      />
    </CardContent>
  </Card>
</template>
