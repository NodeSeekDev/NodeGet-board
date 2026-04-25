<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { Trash2, Loader2 } from "lucide-vue-next";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useI18n } from "vue-i18n";
import { useLifecycle } from "@/composables/useLifecycle";
import { delay } from "@/lib/delay";
import { useBackendExtra } from "@/composables/useBackendExtra";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    showList?: boolean;
    initForm?: {
      newName: string;
      newUrl: string;
      newToken: string;
    };
  }>(),
  {
    showList: true,
    initForm() {
      return {
        newName: "",
        newUrl: "",
        newToken: "",
      };
    },
  },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const { afterServerCreate } = useLifecycle();
const { t } = useI18n();

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit("update:open", val),
});

const { backends, currentBackend, addBackend, removeBackend, selectBackend } =
  useBackendStore();
const { serverInfo, refreshAll } = useBackendExtra();

const newName = ref(props.initForm.newName);
const newUrl = ref(props.initForm.newUrl);
const newToken = ref(props.initForm.newToken);
const isLoading = ref(false);

const resetForm = () => {
  newName.value = props.initForm.newName;
  newUrl.value = props.initForm.newUrl;
  newToken.value = props.initForm.newToken;
};

const handleAdd = async () => {
  if (!newName.value || !newUrl.value || !newToken.value) return;
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    const backend = {
      name: newName.value,
      url: newUrl.value,
      token: newToken.value,
    };
    addBackend(backend);
    // todo: 等待上线🤔
    const maxTrial = 10;
    for (let i = 0; i < maxTrial; i++) {
      try {
        // server online
        if (serverInfo.value[backend.url]?.uuid) {
          break;
        }
        await delay(500);
        await refreshAll();
      } catch (error) {
        console.error(error);
      }
    }
    await afterServerCreate(backend);
    resetForm();
    if (props.showList === false) isOpen.value = false;

    isLoading.value = false;
    // 防止出现有未预料到的未更新的内存变量
    location.reload();
  } catch (e) {
    console.error("Failed to add backend:", e);
    isLoading.value = false;
    // 自动解锁：3秒后恢复正常操作
    setTimeout(() => {
      isLoading.value = false;
    }, 3000);
  }
};

const handleRemove = (b: Backend) => removeBackend(b);
const handleSelect = (b: Backend) => selectBackend(b);

watch(
  () => JSON.stringify(props.initForm),
  () => {
    resetForm();
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{{ t("dashboard.servers.addServer") }}</DialogTitle>
        <DialogDescription>
          {{ t("dashboard.servers.addServerDesc") }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="grid gap-4 py-4"
        :class="{ 'opacity-50 pointer-events-none': isLoading }"
      >
        <!-- 主控列表：仅在 showList !== false 时显示 -->
        <template v-if="showList !== false">
          <div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            <div
              v-if="backends.length === 0"
              class="text-sm text-muted-foreground text-center py-4"
            >
              No backends added. Add one below :D
            </div>
            <div
              v-for="backend in backends"
              :key="backend.url"
              class="flex items-center justify-between p-3 border rounded-md"
              :class="{
                'border-primary bg-primary/5':
                  currentBackend?.url === backend.url &&
                  currentBackend?.token === backend.token,
              }"
            >
              <div class="flex flex-col flex-1 min-w-0 mr-4">
                <div class="flex items-center gap-2">
                  <span class="font-medium truncate">{{ backend.name }}</span>
                  <span
                    v-if="
                      currentBackend?.url === backend.url &&
                      currentBackend?.token === backend.token
                    "
                    class="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full"
                    >Active</span
                  >
                </div>
                <span
                  class="text-xs text-muted-foreground truncate"
                  :title="backend.url"
                  >{{ backend.url }}</span
                >
              </div>

              <div class="flex items-center gap-2">
                <Button
                  v-if="
                    !(
                      currentBackend?.url === backend.url &&
                      currentBackend?.token === backend.token
                    )
                  "
                  size="sm"
                  variant="secondary"
                  @click="handleSelect(backend)"
                  >Select</Button
                >
                <Button
                  size="icon"
                  variant="ghost"
                  :disabled="backend.name === 'Dev'"
                  class="h-8 w-8 text-destructive hover:text-destructive/90"
                  @click="handleRemove(backend)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div class="border-t" />
        </template>

        <!-- 添加表单 -->
        <div class="grid gap-4">
          <span class="text-sm font-medium">{{
            t("dashboard.servers.addServer")
          }}</span>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="name">{{ t("dashboard.servers.fieldName") }}</Label>
              <Input id="name" v-model="newName" placeholder="My Server" />
            </div>
            <div class="space-y-2">
              <Label for="url">{{ t("dashboard.servers.fieldUrl") }}</Label>
              <Input
                id="url"
                v-model="newUrl"
                placeholder="ws://example.com:3000"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="token">{{ t("dashboard.servers.fieldToken") }}</Label>
            <Input
              id="token"
              v-model="newToken"
              type="password"
              placeholder="key:secret username|password"
            />
          </div>
          <RainbowButton
            @click="handleAdd"
            :disabled="!newName || !newUrl || !newToken || isLoading"
          >
            <Loader2 v-if="isLoading" class="h-4 w-4 mr-2 animate-spin" />
            {{
              isLoading
                ? t("dashboard.common.loading")
                : t("dashboard.servers.addServer")
            }}
          </RainbowButton>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
