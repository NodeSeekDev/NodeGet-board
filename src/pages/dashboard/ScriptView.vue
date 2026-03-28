<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-vue-next";
import { toast } from "vue-sonner";

import type { Script } from "@/composables/useScripts";
import { useScripts } from "@/composables/useScripts";
const { scripts, loading, add, del } = useScripts();

import { useI18n } from "vue-i18n";
const { t } = useI18n();

import ScriptFormDialog from "@/components/script/ScriptFormDialog.vue";

const deletingNames = ref<string[]>([]);

watch(scripts, () => {
  console.log("Scripts", scripts.value);
});

import ScriptTable from "@/components/script/ScriptTable.vue";

// form初始化及开关
const saveLoading = ref(false);
const formOpen = ref(false);
const script = ref<Script | null>(null);
const errors = ref<Record<string, string> | null>({});
// 创建
const openCreate = () => {
  console.log("openCreate");
  script.value = null;
  formOpen.value = true;
};
// 编辑
const openEdit = (s: Script) => {
  script.value = s;
  formOpen.value = true;
};
// 删除
const onDel = async (scriptName: string) => {
  deletingNames.value.push(scriptName);
  try {
    await del(scriptName);
    toast.success(scriptName + " " + t("dashboard.scripts.deleteSuccess"));
  } catch (e: any) {
    toast.error(e.message);
  }
  deletingNames.value = deletingNames.value.filter(
    (name) => name !== scriptName,
  );
};

const getRepeatName = (name: string) => {
  return scripts.value.some((script) => script.name === name);
};

const handleSave = async (script: Script) => {
  console.log("handleSave", script);
  saveLoading.value = true;
  if (!script) return;
  if (script.order === -1 && getRepeatName(script.name)) {
    errors.value = { name: t("dashboard.scripts.repeatNameError") };
    toast.error(t("dashboard.scripts.repeatNameError"));
    saveLoading.value = false;
    return;
  }
  try {
    if (script.order === -1) {
      await add({
        name: script.name,
        lang: script.lang,
        content: script.content,
        order: new Date().getTime(),
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
      });
      toast.success(script.name + " " + t("dashboard.scripts.createSuccess"));
    } else {
      await add({
        name: script.name,
        lang: script.lang,
        content: script.content,
        order: script.order,
        created_at: script.created_at,
        updated_at: new Date().getTime(),
      });
      toast.success(script.name + " " + t("dashboard.scripts.editSuccess"));
    }

    saveLoading.value = false;
    formOpen.value = false;
  } catch (e: any) {
    toast.error(e.message);
    saveLoading.value = false;
  }
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

    <div class="rounded-md border">
      <ScriptTable
        :loading="loading"
        :scripts="scripts"
        :deletingNames="deletingNames"
        @edit="openEdit"
        @delete="onDel"
      ></ScriptTable>
    </div>

    <ScriptFormDialog
      v-model:open="formOpen"
      :script="script"
      :saving="saveLoading"
      :errors="errors"
      @save="handleSave"
    />
  </div>
</template>
