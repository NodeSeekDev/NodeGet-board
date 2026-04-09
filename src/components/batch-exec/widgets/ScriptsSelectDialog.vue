<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Script } from "@/composables/useScripts";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  scripts: Script[];
}>();

const emit = defineEmits<{
  (e: "update:open", val: boolean): void;
  (e: "pick", val: string): void;
}>();

const search = ref("");
const selectScript = ref<Script>({
  name: "",
  lang: "shell",
  content: "",
  order: 0,
  created_at: 0,
  updated_at: 0,
});
const handleSelect = () => {
  if (selectScript.value.name == "") {
    return;
  }
  selectScript.value.name = "";
  emit("pick", selectScript.value.content);
  emit("update:open", false);
};
const scripts = computed(() => {
  return props.scripts.filter((script) => {
    return script.name.toLowerCase().includes(search.value.toLowerCase());
  });
});

const pickScript = (script: Script) => {
  if (selectScript.value.name == script.name) {
    selectScript.value.name = "";
    return;
  }
  selectScript.value = { ...script };
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ t("dashboard.batchExec.scriptsSelect") }}
        </DialogTitle>
        <DialogDescription>
          {{ t("dashboard.batchExec.scripts.desc") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.batchExec.scripts.search") }}</Label>
          <Input
            v-model="search"
            :placeholder="t('dashboard.batchExec.scripts.searchPlaceholder')"
          />
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.batchExec.scripts.search") }}</Label>
          <div class="flex flex-col gap-1 h-[20vh] overflow-y-auto">
            <Button
              :variant="
                selectScript.name == script.name ? 'default' : 'outline'
              "
              class="flex flex-col gap-1 items-start h-auto border"
              v-for="script in scripts"
              @click="pickScript(script)"
            >
              <div class="flex flex-row gap-1 items-start">
                <div class="text-base font-blod">{{ script.name }}</div>
                <div>
                  <Badge
                    class="text-xs font-mono"
                    :variant="
                      selectScript.name == script.name ? 'secondary' : 'outline'
                    "
                  >
                    {{ script.lang }}
                  </Badge>
                </div>
              </div>
              <div class="flex flex-col gap-1 items-start w-full text-left">
                <div class="truncate text-xs opacity-80 break-words w-full">
                  {{ script.content }}
                </div>
              </div>
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{
          t("dashboard.batchExec.scripts.cancel")
        }}</Button>
        <Button @click="handleSelect">
          {{ t("dashboard.batchExec.scripts.select") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
