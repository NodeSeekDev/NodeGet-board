<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import type { Script } from "@/composables/useScripts";
const props = defineProps<{
  open: boolean;
  saving: boolean;
  script?: Script | null;
  errors: Record<string, string> | null;
}>();
const defaultForm = () => ({
  name: "",
  lang: "shell" as "shell" | "js",
  content: "",
  order: -1,
  created_at: -1,
  updated_at: -1,
});
const errors = ref<Record<string, string>>({});
const form = ref(defaultForm());

const validateForm = (): boolean => {
  errors.value = {};

  if (!form.value.name.trim()) {
    errors.value.name = t("dashboard.scripts.nameRequired");
  } else if (form.value.name.includes("*")) {
    errors.value.name = t("dashboard.scripts.nameCannotContainAsterisk");
  }

  if (!form.value.content.trim()) {
    errors.value.content = t("dashboard.scripts.contentRequired");
  }
  console.log(Object.keys(errors.value).length);
  return Object.keys(errors.value).length === 0;
};

const handleSave = async () => {
  if (!validateForm()) return;
  emit("save", form.value);
};

const emit = defineEmits<{
  (e: "update:open", val: boolean): void;
  (e: "save", val: Script): void;
}>();

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.script) {
        form.value = {
          name: props.script.name,
          content: props.script.content,
          lang: props.script.lang,
          order: props.script.order,
          created_at: props.script.created_at,
          updated_at: props.script.updated_at,
        };
      } else {
        form.value = defaultForm();
      }
    }
    errors.value = {};
  },
);

watch(
  () => props.errors,
  (val) => {
    if (val) {
      errors.value = val;
    }
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            script ? t("dashboard.scripts.edit") : t("dashboard.scripts.create")
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("dashboard.scripts.desc") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.scripts.name") }}</Label>
          <Input
            v-model="form.name"
            :placeholder="t('dashboard.scripts.name')"
            :disabled="!!script || saving"
          />
          <p v-if="errors.name" class="text-xs text-destructive">
            {{ errors.name }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.scripts.lang") }}</Label>
          <Select v-model="form.lang" :disabled="saving">
            <SelectTrigger class="w-full" :disabled="saving">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shell">shell</SelectItem>
              <SelectItem value="js">js</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.scripts.content") }}</Label>
          <Textarea
            v-model="form.content"
            :placeholder="t('dashboard.scripts.content')"
            :disabled="saving"
          />
          <p v-if="errors.content" class="text-xs text-destructive">
            {{ errors.content }}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="emit('update:open', false)"
          >{{ t("dashboard.scripts.cancel") }}</Button
        >
        <Button :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          {{ saving ? t("dashboard.saving") : t("dashboard.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
