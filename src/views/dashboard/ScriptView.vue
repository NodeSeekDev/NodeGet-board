<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-vue-next";

import type { Script } from "@/composables/useScripts";
import { useScripts } from "@/composables/useScripts";
const { scripts, loading, add, del } = useScripts();

const deletingNames = ref<string[]>([]);

watch(scripts, () => {
  console.log("Scripts", scripts.value);
});

import ScriptTable from "@/components/script/ScriptTable.vue";

const openCreate = () => {
  console.log("openCreate");
  add({
    name: "test3",
    lang: "shell",
    content: "string",
    order: new Date().getTime(),
    created_at: new Date().getTime(),
    updated_at: new Date().getTime(),
  });
};
</script>

<template>
  <div>
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t("router.scripts") }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t("dashboard.scripts.desc") }}
        </p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4 mr-1.5" />
        {{ $t("dashboard.scripts.create") }}
      </Button>
    </div>

    <div class="grid gap-2 xl:grid-cols-1 mt-2">
      <ScriptTable
        :loading="loading"
        :scripts="scripts"
        :deletingNames="deletingNames"
      ></ScriptTable>
    </div>
  </div>
</template>
