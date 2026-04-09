<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Plus, FileTerminal, Menu } from "lucide-vue-next";
import { toast } from "vue-sonner";

definePage({
  meta: {
    title: "router.scripts",
    icon: FileTerminal,
    order: 8,
    group: "router.group.tools",
  },
});

import type { Script } from "@/composables/useScripts";
import { useScripts } from "@/composables/useScripts";
const { scripts, loading, add, del } = useScripts();

import { useI18n } from "vue-i18n";
const { t } = useI18n();

import ScriptFormDialog from "@/components/script/ScriptFormDialog.vue";

const deletingNames = ref<string[]>([]);

watch(scripts, () => {});

import ScriptTable from "@/components/script/ScriptTable.vue";

// form初始化及开关
const saveLoading = ref(false);
const formOpen = ref(false);
const script = ref<Script | null>(null);
const errors = ref<Record<string, string> | null>({});
const sortable = ref(false);
// 创建
const openCreate = () => {
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

// 修改Order
const updateOrder = async (script: Script) => {
  if (!script) return;
  try {
    add(script);
  } catch (e: any) {
    toast.error(e.message);
  }
};

const getRepeatName = (name: string) => {
  return scripts.value.some((script) => script.name === name);
};

const handleSave = async (script: Script) => {
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
      <div class="flex-1">
        <h1 class="text-2xl font-semibold">{{ $t("router.scripts") }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t("dashboard.scripts.desc") }}
        </p>
      </div>
      <div class="flex flex-col md:flex-row gap-1 md:gap-2">
        <Button @click="sortable = !sortable" size="sm" variant="outline">
          <Menu class="h-4 w-4 mr-1.5" />
          {{
            sortable
              ? $t("dashboard.scripts.sortSave")
              : $t("dashboard.scripts.sortEdit")
          }}
        </Button>
        <Button @click="openCreate" size="sm">
          <Plus class="h-4 w-4 mr-1.5" />
          {{ $t("dashboard.scripts.create") }}
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <ScriptTable
        :loading="loading"
        :scripts="scripts"
        :deletingNames="deletingNames"
        :sortable="sortable"
        @edit="openEdit"
        @delete="onDel"
        @updateOrder="updateOrder"
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
