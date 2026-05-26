<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Loader2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  upload: [path: string, base64: string];
}>();

const filePath = ref("");
const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const canUpload = computed(() => !!selectedFile.value && !!filePath.value);

watch(
  () => props.open,
  (val) => {
    if (val) {
      filePath.value = "";
      selectedFile.value = null;
    }
  },
);

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  selectedFile.value = file;
  if (file && !filePath.value) {
    filePath.value = file.name;
  }
};

const handleUpload = () => {
  if (!selectedFile.value || !filePath.value) return;
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result as string).split(",")[1] ?? "";
    emit("upload", filePath.value, base64);
  };
  reader.readAsDataURL(selectedFile.value);
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>上传文件</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-1.5">
          <Label>选择文件 <span class="text-destructive">*</span></Label>
          <div
            class="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            @click="fileInput?.click()"
          >
            <Upload class="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              {{ selectedFile ? selectedFile.name : "点击选择文件" }}
            </p>
            <p v-if="selectedFile" class="text-xs text-muted-foreground mt-1">
              {{ (selectedFile.size / 1024).toFixed(1) }} KB
            </p>
          </div>
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="onFileChange"
          />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)"
          >取消</Button
        >
        <Button :disabled="loading || !canUpload" @click="handleUpload">
          <Loader2 v-if="loading" class="h-4 w-4 mr-1 animate-spin" />
          上传
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
