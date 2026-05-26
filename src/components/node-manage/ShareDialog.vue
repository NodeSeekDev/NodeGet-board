<script setup lang="ts">
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { computed, onMounted, ref, watch } from "vue";
import { Loader2, Check } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "vue-i18n";
import { type Backend } from "@/composables/useBackendStore";
import { toast } from "vue-sonner";
import { unicodeToBase64 } from "@/lib/base64";
import qrcode from "@/components/misc/qrcode.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    backend: Backend;
  }>(),
  {
    open: true,
  },
);

const { t } = useI18n();

const shareLink = computed(() => {
  const origin = location.origin;
  const fill = unicodeToBase64(JSON.stringify(props.backend));
  return `${origin}/#/dashboard/node-manage?tab=servers&fill=${fill}`;
});

const emit = defineEmits<{
  (e: "select-version", val: string): void;
  (e: "update:open", val: boolean): void;
}>();

const copied = ref(false);
const copyText = (text: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle> 链接信息</DialogTitle>
        <DialogDescription>
          {{ backend.name }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <qrcode :text="shareLink" class="flex w-full justify-center"></qrcode>
        <div class="space-y-1.5 wrap-break-word">
          <code class="px-1 font-mono text-sm">{{ shareLink }}</code>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="copyText(shareLink)">
          复制
          <Check v-if="copied" class="h-3.5 w-3.5 text-green-500" />
        </Button>
        <Button @click="$emit('update:open', false)"> 确定 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
