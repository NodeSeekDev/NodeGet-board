<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Loader2,
  CircleCheckBig,
  RefreshCw,
  Copy,
  Check,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Codemirror } from "vue-codemirror";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { StreamLanguage } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { useThemeStore } from "@/stores/theme";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  useTask,
  type CreateTaskBlockingResponse,
} from "@/composables/useTask";
import { useBackendExtra } from "@/composables/useBackendExtra";
import { reGenerateToken } from "@/components/agents/generateToken";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    uuid: string;
  }>(),
  {
    uuid: "",
  },
);

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  added: [];
}>();

const { t } = useI18n();
const themeStore = useThemeStore();
const { currentBackendInfo } = useBackendExtra();
const { createVersionTask } = useTask();

// 预生成的 token
const generatedToken = ref("");

reGenerateToken(props.uuid)
  .then((newToken) => {
    if (!newToken) {
      toast.error("预生成 token 失败，可能会导致安装失败，请重试");
      return;
    }
    generatedToken.value = newToken;
  })
  .catch((e) => {
    console.error("Failed to pre-generate token:", e);
    toast.error("预生成 token 失败，可能会导致安装失败，请重试");
  });

const isOnline = ref(false);
const isCopied = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const checkOnline = async () => {
  if (!currentBackendInfo.value) return;
  try {
    const conn = getWsConnection(currentBackendInfo.value.url);
    const result = await conn.call<{ uuids: string[] }>(
      "nodeget-server_list_all_agent_uuid",
      { token: currentBackendInfo.value.token },
    );
    const version = await createVersionTask(props.uuid, true, 1500);
    isOnline.value = (version as CreateTaskBlockingResponse).success;
  } catch {
    // ignore
  }
};

const startPolling = () => {
  stopPolling();
  isOnline.value = false;
  pollTimer = setInterval(checkOnline, 3000);
  checkOnline();
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const copyInstallScript = async () => {
  try {
    await navigator.clipboard.writeText(installScript.value);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (e) {
    console.error("Failed to copy:", e);
  }
};

// 安装脚本内容 (4 参数)
const installScript = computed(() => {
  const uuid = props.uuid || "{AGENT_UUID}";
  const token = generatedToken.value || "{TOKEN}";
  const serverWs =
    currentBackendInfo.value?.agentConfigWsUrl ||
    currentBackendInfo.value?.url ||
    "{Server_WS}";
  const serverName = currentBackendInfo.value?.name || "{Server_NAME}";
  return `bash <(curl -sL ${import.meta.env.VITE_INSTALL_URL}) install-agent  \\
  --agent-id "${uuid}" \\
  --token "${token}" \\
  --server-ws "${serverWs}" \\
  --server-id "${currentBackendInfo.value?.uuid}" \\
  --server-name "${serverName}"`;
});

const editorExtensions = computed(() => [
  StreamLanguage.define(shell),
  ...(themeStore.isDark ? [oneDark] : []),
]);

onMounted(startPolling);
onUnmounted(stopPolling);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[80vh] grid-rows-[auto_1fr_auto] p-0 sm:max-w-xl"
    >
      <DialogHeader class="px-6 pt-6 pb-2">
        <DialogTitle>{{ t("dashboard.agents.addTitle") }}</DialogTitle>
        <DialogDescription>
          已关闭此agent的历史授权token，并生成新的连接命令和token，已连接的agent（如果存在）会被强制断开连接，直至使用新的连接命令重新连接，适用于重装系统后恢复连接
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 overflow-y-auto px-6">
        <div class="space-y-4 py-2">
          <div>
            <h3 class="text-base font-medium">
              {{ t("dashboard.agents.installTitle") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t("dashboard.agents.installSubtitle") }}
            </p>
          </div>
          <div class="relative overflow-hidden rounded-md border">
            <button
              type="button"
              @click="copyInstallScript"
              class="absolute top-2 right-2 z-10 rounded-md border border-border/50 bg-background/80 p-1.5 transition-colors hover:border-border hover:bg-background"
              :title="isCopied ? 'Copied!' : 'Copy to clipboard'"
            >
              <Check v-if="isCopied" class="h-4 w-4 text-green-500" />
              <Copy v-else class="h-4 w-4 text-muted-foreground" />
            </button>
            <Codemirror
              :model-value="installScript"
              :extensions="editorExtensions"
              :disabled="true"
              :style="{ minHeight: '120px' }"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            定时器每3秒检查一次agent是否在线，运行后请耐心等待agent上线
          </p>
        </div>

        <div
          class="flex flex-col items-center justify-center gap-4 py-8"
          v-if="isOnline"
        >
          <CircleCheckBig class="h-16 w-16 text-green-500" />
          <h3 class="text-xl font-semibold">
            {{ t("dashboard.agents.completed") }}
          </h3>
        </div>
      </div>

      <DialogFooter class="px-6 pt-2 pb-6">
        <Button
          variant="outline"
          @click="
            $emit('added');
            $emit('update:open', false);
          "
        >
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
