<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
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
import { Plus, Trash2, Loader2, Route } from "lucide-vue-next";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useI18n } from "vue-i18n";
import { useLifecycle } from "@/composables/useLifecycle";
import { delay } from "@/lib/delay";
import { useBackendExtra } from "@/composables/useBackendExtra";
import { useRouter } from "vue-router";
import mockInput from "@/components/misc/mockInput.vue";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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
const router = useRouter();

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit("update:open", val),
});

const { backends, currentBackend, addBackend, removeBackend, selectBackend } =
  useBackendStore();
const { serverInfo, refreshAll } = useBackendExtra();

const newName = ref(props.initForm.newName);
const newToken = ref(props.initForm.newToken);
const newProtocol = ref("wss:");
const newHost = ref("");
const newPathname = ref("/nodeget/rpc");
const isLoading = ref(false);

const protocolList = location.protocol === "https:" ? ["wss"] : ["wss", "ws"];

const newUrl = computed(() => {
  if (!newHost.value) return "";
  try {
    const host = parseHost(newHost.value);
    if (!host) return "";
    return `${newProtocol.value}//${host}${newPathname.value}`;
  } catch {
    return "";
  }
});

/**
 * 解析输入字符串，返回 host:port
 * @param {string} input - 可能是域名、URL、带端口的字符串
 * @returns {string} - 返回 host 或 host:port
 */
function parseHost(input: string) {
  if (!input || typeof input !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  // 如果没有协议，临时加上
  let url;
  try {
    url = new URL(input);
  } catch (e) {
    try {
      url = new URL(`http://${input}`);
    } catch (err) {
      throw new Error(`Invalid URL or host: ${input}`);
    }
  }

  // URL.host 包含端口号，如果有的话
  return url.host;
}

function normalizeHost() {
  if (!newHost.value) return;
  nextTick(() => {
    const host = parseHost(newHost.value);
    if (host !== newHost.value) {
      newHost.value = host;
    }
  });
}

const resetForm = () => {
  newName.value = props.initForm.newName;
  newToken.value = props.initForm.newToken;
  if (props.initForm.newUrl) {
    const url = new URL(props.initForm.newUrl);
    newProtocol.value = url.protocol;
    newHost.value = url.host;
    // newPort.value = /^(\d+)$/.test(url.port) ? parseInt(url.port) : 2211;
    newPathname.value = url.pathname;
  }
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
    await afterServerCreate(backend);

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
    resetForm();
    if (props.showList === false) isOpen.value = false;

    isLoading.value = false;
    // 防止出现有未预料到的未更新的内存变量
    router.replace({
      name: "/dashboard/node-manage",
      query: {
        tab: "servers",
      },
    });
    await delay(100);
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
        :class="{ 'pointer-events-none opacity-50': isLoading }"
      >
        <!-- 主控列表：仅在 showList !== false 时显示 -->
        <template v-if="showList !== false">
          <div class="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
            <div
              v-if="backends.length === 0"
              class="py-4 text-center text-sm text-muted-foreground"
            >
              No backends added. Add one below :D
            </div>
            <div
              v-for="backend in backends"
              :key="backend.url"
              class="flex items-center justify-between rounded-md border p-3"
              :class="{
                'border-primary bg-primary/5':
                  currentBackend?.url === backend.url &&
                  currentBackend?.token === backend.token,
              }"
            >
              <div class="mr-4 flex min-w-0 flex-1 flex-col">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ backend.name }}</span>
                  <span
                    v-if="
                      currentBackend?.url === backend.url &&
                      currentBackend?.token === backend.token
                    "
                    class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >Active</span
                  >
                </div>
                <span
                  class="truncate text-xs text-muted-foreground"
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
              <Label for="host">{{ t("dashboard.servers.fieldHost") }}</Label>
              <Input
                id="host"
                v-model="newHost"
                @blur="normalizeHost()"
                placeholder="example.com"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="protocol">{{
                t("dashboard.servers.fieldProtocol")
              }}</Label>
              <!-- <Input id="protocol" v-model="newProtocol" placeholder="wss" /> -->
              <Select v-model="newProtocol">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="item in protocolList"
                    :value="item + ':'"
                    >{{ item }}</SelectItem
                  >
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="pathname">{{
                t("dashboard.servers.fieldPathname")
              }}</Label>
              <Input
                id="pathname"
                v-model="newPathname"
                placeholder="/nodeget/rpc"
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
            <!-- todo: xss check, not enabled now -->
            <!-- <mockInput
              id="token"
              v-model="newToken"
              type="password"
              placeholder="key:secret username|password"
            /> -->
          </div>
          <RainbowButton
            v-if="(newName && newUrl && newToken) || isLoading"
            @click="handleAdd"
            :disabled="!newName || !newUrl || !newToken || isLoading"
          >
            <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
            <Plus v-else class="mr-2 h-4 w-4" />
            {{
              isLoading
                ? t("dashboard.servers.addServerLoading")
                : t("dashboard.servers.addServer")
            }}
          </RainbowButton>
          <Button v-else disabled variant="outline" class="h-11 rounded-xl">
            <Plus class="mr-2 h-4 w-4" />{{ t("dashboard.servers.addServer") }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
