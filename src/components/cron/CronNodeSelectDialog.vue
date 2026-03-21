<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface NodeItem {
  uuid: string;
  customName: string;
}

const props = defineProps<{
  open: boolean;
  selectedIds: string[];
  nodes: NodeItem[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [ids: string[]];
}>();

const { t } = useI18n();

const localSelected = ref<string[]>([]);

watch([() => props.open, () => props.selectedIds], ([open, ids]) => {
  if (open) {
    localSelected.value = [...ids];
  }
});

const toggle = (uuid: string, checked: boolean) => {
  if (checked) {
    if (!localSelected.value.includes(uuid)) {
      localSelected.value.push(uuid);
    }
  } else {
    const idx = localSelected.value.indexOf(uuid);
    if (idx !== -1) {
      localSelected.value.splice(idx, 1);
    }
  }
};

const handleConfirm = () => {
  emit("confirm", [...localSelected.value]);
  emit("update:open", false);
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("dashboard.cron.selectNodes") }}</DialogTitle>
        <DialogDescription>{{
          t("dashboard.cron.selectNodesDesc")
        }}</DialogDescription>
      </DialogHeader>
      <div class="max-h-72 overflow-y-auto space-y-2 py-2">
        <div
          v-for="node in nodes"
          :key="node.uuid"
          class="flex items-center gap-3 rounded-md px-2 py-1.5"
        >
          <Checkbox
            :model-value="localSelected.includes(node.uuid)"
            @update:model-value="(checked) => toggle(node.uuid, !!checked)"
          />
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-medium truncate">{{
              node.customName || node.uuid
            }}</span>
            <span class="text-xs text-muted-foreground font-mono truncate">{{
              node.uuid
            }}</span>
          </div>
        </div>
        <p
          v-if="!nodes.length"
          class="text-sm text-muted-foreground text-center py-4"
        >
          {{ t("dashboard.cron.noNodes") }}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{
          t("dashboard.cron.cancel")
        }}</Button>
        <Button @click="handleConfirm">{{ t("dashboard.save") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
