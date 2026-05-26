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
import { Loader2 } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    open: boolean;
    availableVersions: string[];
  }>(),
  {
    open: true,
    availableVersion() {
      return [];
    },
  },
);

const errors = ref<Record<string, string>>({});
const { t } = useI18n();

// const availableVersion = ref<string[]>([])
const versionSelected = ref<string>("");

const handleSave = async () => {
  emit("select-version", versionSelected.value);
};

const emit = defineEmits<{
  (e: "select-version", val: string): void;
  (e: "update:open", val: boolean): void;
}>();

watch(
  () => props.availableVersions,
  () => {
    if (props.availableVersions.length) {
      versionSelected.value = props.availableVersions[0] as string;
    }
  },
  {
    immediate: true,
    deep: true,
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle> 版本号 </DialogTitle>
        <!-- <DialogDescription>
        </DialogDescription> -->
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <div class="space-y-1.5">
          <Label>选择版本号</Label>
          <Select v-model="versionSelected">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="version in availableVersions"
                :value="version"
                >{{ version }}</SelectItem
              >
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{
          t("dashboard.scripts.cancel")
        }}</Button>
        <Button @click="handleSave"> 确定 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
