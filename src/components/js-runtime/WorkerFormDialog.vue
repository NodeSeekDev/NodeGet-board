<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2 } from "lucide-vue-next";
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeStore } from "@/stores/theme";
import type { JsWorker } from "@/composables/useJsRuntime";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  editWorker?: JsWorker;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [name: string, content: string];
}>();

const { t } = useI18n();
const themeStore = useThemeStore();

const name = ref("");
const content = ref("");

const defaultContent = `export default {
  async onCall(params, env, ctx) {
    return { ok: true, from: "onCall", params, env };
  },
  async onInlineCall(params, env, ctx) {
    return { ok: true, from: "onInlineCall", params, env };
  },
  async onCron(params, env, ctx) {
    return { ok: true, from: "onCron", params, env };
  },
  async onRoute(request, env, ctx) {
    return new Response("ok", { status: 200 });
  }
};`;

const extensions = computed(() => [
  javascript(),
  ...(themeStore.isDark ? [oneDark] : []),
]);

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = props.editWorker?.name ?? "";
      content.value = props.editWorker?.content ?? defaultContent;
    }
  },
);

const handleSave = () => {
  if (!name.value.trim()) return;
  emit("save", name.value.trim(), content.value);
};

const close = () => emit("update:open", false);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-3xl h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{{
          editWorker
            ? t("dashboard.jsRuntime.editWorker")
            : t("dashboard.jsRuntime.addWorker")
        }}</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-hidden space-y-4 flex flex-col">
        <div class="space-y-2">
          <Label for="worker-name">{{ t("dashboard.jsRuntime.name") }}</Label>
          <Input
            id="worker-name"
            v-model="name"
            :placeholder="t('dashboard.jsRuntime.name')"
          />
        </div>

        <div class="space-y-2 flex-1 flex flex-col overflow-hidden">
          <Label>{{ t("dashboard.jsRuntime.content") }}</Label>
          <div class="flex-1 rounded-md border overflow-hidden min-h-0">
            <Codemirror
              v-model="content"
              :extensions="extensions"
              class="h-full text-[13px]"
              :style="{ height: '100%' }"
            />
          </div>
        </div>
      </div>

      <DialogFooter class="pt-4">
        <Button variant="outline" @click="close">{{
          t("dashboard.jsRuntime.cancel")
        }}</Button>
        <Button :disabled="loading || !name.trim()" @click="handleSave">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          {{
            editWorker
              ? t("dashboard.jsRuntime.save")
              : t("dashboard.jsRuntime.create")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
