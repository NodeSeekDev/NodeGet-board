<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  create: [namespace: string];
}>();

const namespaceName = ref("");

watch(
  () => props.open,
  (val) => {
    if (val) namespaceName.value = "";
  },
);

const handleCreate = () => {
  const name = namespaceName.value.trim();
  if (!name) return;
  emit("create", name);
};

const close = () => emit("update:open", false);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>创建命名空间</DialogTitle>
        <DialogDescription
          >命名空间用于隔离不同的 KV 数据集合</DialogDescription
        >
      </DialogHeader>

      <div class="space-y-2">
        <Label for="ns-name">命名空间名称</Label>
        <Input
          id="ns-name"
          v-model="namespaceName"
          placeholder="输入命名空间名称，例如 global"
          @keydown.enter="handleCreate"
        />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">取消</Button>
        <Button
          :disabled="loading || !namespaceName.trim()"
          @click="handleCreate"
        >
          {{ loading ? "创建中..." : "创建" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
