<script setup lang="ts">
import { ref, watch } from "vue";
import { Loader2, Plus, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useThemeTokenPresets,
  type TokenPreset,
} from "@/composables/useThemeTokenPresets";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { loadOrInitPresets, savePresets } = useThemeTokenPresets();

const presets = ref<TokenPreset[]>([]);
const saving = ref(false);
const loading = ref(false);

const loadPresets = async () => {
  loading.value = true;
  try {
    presets.value = await loadOrInitPresets();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "加载预设失败");
    presets.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.open,
  (val) => {
    if (val) loadPresets();
  },
);

const addRow = () => {
  presets.value.push({ name: "", backend_url: "", token: "" });
};

const removeRow = (index: number) => {
  presets.value.splice(index, 1);
};

const handleSave = async () => {
  const tokens = presets.value.map((p) => p.token).filter(Boolean);
  if (new Set(tokens).size !== tokens.length) {
    toast.error("存在重复的 Token，请检查后重试");
    return;
  }
  saving.value = true;
  try {
    const normalized = presets.value.map((p) => {
      if (!p.backend_url) return p;
      try {
        const parsed = new URL(p.backend_url);
        return { ...p, backend_url: `${parsed.protocol}//${parsed.host}` };
      } catch {
        return p;
      }
    });
    await savePresets(normalized);
    toast.success("Token 预设已保存");
    emit("update:open", false);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Token 预设管理</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <div v-if="loading" class="flex items-center justify-center py-6">
          <Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div
            v-if="presets.length"
            class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground"
          >
            <span>名称</span>
            <span>后端 URL</span>
            <span>Token</span>
            <span />
          </div>

          <div
            v-for="(preset, i) in presets"
            :key="i"
            class="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
          >
            <Input v-model="preset.name" placeholder="名称" />
            <Input v-model="preset.backend_url" placeholder="https://..." />
            <Input v-model="preset.token" placeholder="token" />
            <Button
              variant="ghost"
              size="icon"
              class="shrink-0"
              @click="removeRow(i)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>

          <div
            v-if="!presets.length"
            class="py-4 text-center text-sm text-muted-foreground"
          >
            暂无预设，点击「新增」添加
          </div>

          <Button variant="outline" size="sm" class="w-full" @click="addRow">
            <Plus class="mr-1 h-4 w-4" />
            新增
          </Button>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="mr-1 h-4 w-4 animate-spin" />
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
