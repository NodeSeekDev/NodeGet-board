<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Loader2, CircleCheckBig, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
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
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useCron, type BackendCron } from "@/composables/useCron";

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  added: [];
}>();

const { t } = useI18n();
const router = useRouter();
const themeStore = useThemeStore();
const { backends, currentBackend } = useBackendStore();
const { list: listCrons } = useCron();

const step = ref(1);

// Step 1: 基础信息
const nodeName = ref("");
const nodeUuid = ref("");
const serverUrl = ref("");

const generateUuid = () => {
  nodeUuid.value = crypto.randomUUID();
};

const resetForm = () => {
  step.value = 1;
  nodeName.value = "";
  nodeUuid.value = "";
  serverUrl.value = "";
  selectedCronIds.value = new Set();
  staticRetention.value = undefined;
  dynamicRetention.value = undefined;
  agentTaskRetention.value = undefined;
  isOnline.value = false;
};

// Step 2: 预配置
const cronList = ref<BackendCron[]>([]);
const selectedCronIds = ref<Set<number>>(new Set());
const staticRetention = ref<number | undefined>();
const dynamicRetention = ref<number | undefined>();
const agentTaskRetention = ref<number | undefined>();

const loadCrons = async () => {
  if (!currentBackend.value) return;
  try {
    cronList.value = await listCrons();
  } catch {
    cronList.value = [];
  }
};

// Step 3: 安装
const isOnline = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const checkOnline = async () => {
  if (!currentBackend.value) return;
  try {
    const conn = getWsConnection(currentBackend.value.url);
    const result = await conn.call<{ uuids: string[] }>(
      "nodeget-server_list_all_agent_uuid",
      { token: currentBackend.value.token },
    );
    if (result?.uuids?.includes(nodeUuid.value)) {
      isOnline.value = true;
      stopPolling();
    }
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

onUnmounted(stopPolling);

// 安装脚本内容
const installScript = computed(() => {
  const uuid = nodeUuid.value || "{AGENT_UUID}";
  const serverUuid = currentBackend.value ? "..." : "{Server_UUID}";
  const serverWs = serverUrl.value || "{Server_WS}";
  const serverName = currentBackend.value?.name || "{Server_NAME}";
  return `bash <(curl https://install.nodeget.com) \\
  --agent-id ${uuid} \\
  --server-id ${serverUuid} \\
  --server-ws ${serverWs} \\
  --server-name ${serverName}`;
});

const editorExtensions = computed(() => [
  StreamLanguage.define(shell),
  ...(themeStore.isDark ? [oneDark] : []),
]);

// 步骤导航
const canNext = computed(() => {
  if (step.value === 1) {
    return nodeName.value.trim() && nodeUuid.value.trim();
  }
  return true;
});

const handleNext = () => {
  if (step.value === 1) {
    step.value = 2;
    loadCrons();
  } else if (step.value === 2) {
    step.value = 3;
    startPolling();
  } else if (step.value === 3) {
    step.value = 4;
  }
};

const handlePrev = () => {
  if (step.value === 2) {
    step.value = 1;
  } else if (step.value === 3) {
    stopPolling();
    step.value = 2;
  }
};

const handleContinueAdding = () => {
  open.value = false;
  // 延迟重置，等关闭动画结束
  setTimeout(() => {
    resetForm();
    open.value = true;
  }, 200);
};

const handleAdjustNode = () => {
  open.value = false;
  emit("added");
  if (nodeUuid.value) {
    router.push(`/dashboard/node/${nodeUuid.value}/setting`);
  }
};

watch(open, (value) => {
  if (value) {
    generateUuid();
  } else {
    stopPolling();
  }
});

// 进度指示器
const steps = [
  { key: 1, label: "step1" },
  { key: 2, label: "step2" },
  { key: 3, label: "step3" },
  { key: 4, label: "step4" },
] as const;
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-xl max-h-[80vh] grid-rows-[auto_1fr_auto] p-0"
    >
      <DialogHeader class="px-6 pt-6 pb-2">
        <DialogTitle>{{ t("dashboard.agents.addTitle") }}</DialogTitle>
        <DialogDescription>
          <!-- Step 进度指示器 -->
          <div class="flex items-center justify-center gap-1 pt-2">
            <template v-for="(s, i) in steps" :key="s.key">
              <div class="flex items-center gap-1.5">
                <div
                  class="size-2 rounded-full transition-colors"
                  :class="
                    step >= s.key ? 'bg-primary' : 'bg-muted-foreground/30'
                  "
                />
                <span
                  class="text-xs"
                  :class="
                    step >= s.key
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  "
                >
                  {{ t(`dashboard.agents.${s.label}`) }}
                </span>
              </div>
              <div
                v-if="i < steps.length - 1"
                class="w-6 h-px mx-1"
                :class="step > s.key ? 'bg-primary' : 'bg-muted-foreground/30'"
              />
            </template>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div class="overflow-y-auto px-6 min-h-0">
        <!-- Step 1: 基础信息 -->
        <div v-if="step === 1" class="space-y-4 py-2">
          <div class="space-y-2">
            <Label>{{ t("dashboard.agents.fieldName") }}</Label>
            <Input v-model="nodeName" />
          </div>
          <div class="space-y-2">
            <Label>{{ t("dashboard.agents.fieldUuid") }}</Label>
            <div class="flex gap-2">
              <Input v-model="nodeUuid" readonly class="font-mono text-xs" />
              <Button variant="outline" size="sm" @click="generateUuid">
                <RefreshCw class="h-3.5 w-3.5 mr-1" />
                {{ t("dashboard.agents.generateUuid") }}
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ t("dashboard.agents.fieldServerUrl") }}</Label>
            <Input v-model="serverUrl" />
          </div>
        </div>

        <!-- Step 2: 预配置 -->
        <div v-if="step === 2" class="space-y-4 py-2">
          <div class="space-y-2">
            <Label class="text-base">{{
              t("dashboard.agents.cronSection")
            }}</Label>
            <div
              v-if="cronList.length === 0"
              class="text-sm text-muted-foreground py-2"
            >
              -- 暂无定时任务 --
            </div>
            <div v-else class="space-y-2 max-h-40 overflow-y-auto">
              <div
                v-for="cron in cronList"
                :key="cron.id"
                class="flex items-center gap-2"
              >
                <Checkbox
                  :checked="selectedCronIds.has(cron.id)"
                  @update:checked="
                    (v: boolean) => {
                      if (v) selectedCronIds.add(cron.id);
                      else selectedCronIds.delete(cron.id);
                    }
                  "
                />
                <span class="text-sm">{{ cron.name }}</span>
                <span class="text-xs text-muted-foreground font-mono">
                  {{ cron.cron_expression }}
                </span>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <Label class="text-base">{{
              t("dashboard.agents.storageSection")
            }}</Label>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm">
                {{ t("dashboard.agents.staticMonitoring") }}
              </span>
              <div class="flex items-center gap-1.5">
                <NumberField
                  :model-value="staticRetention"
                  :min="0"
                  class="w-28"
                  @update:model-value="staticRetention = $event"
                />
                <span class="text-sm text-muted-foreground whitespace-nowrap">
                  {{ t("dashboard.agents.minuteUnit") }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm">
                {{ t("dashboard.agents.dynamicMonitoring") }}
              </span>
              <div class="flex items-center gap-1.5">
                <NumberField
                  :model-value="dynamicRetention"
                  :min="0"
                  class="w-28"
                  @update:model-value="dynamicRetention = $event"
                />
                <span class="text-sm text-muted-foreground whitespace-nowrap">
                  {{ t("dashboard.agents.minuteUnit") }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm">
                {{ t("dashboard.agents.agentTask") }}
              </span>
              <div class="flex items-center gap-1.5">
                <NumberField
                  :model-value="agentTaskRetention"
                  :min="0"
                  class="w-28"
                  @update:model-value="agentTaskRetention = $event"
                />
                <span class="text-sm text-muted-foreground whitespace-nowrap">
                  {{ t("dashboard.agents.minuteUnit") }}
                </span>
              </div>
            </div>
          </div>

          <p class="text-xs text-muted-foreground">
            {{ t("dashboard.agents.storageHint") }}
          </p>
        </div>

        <!-- Step 3: 安装 -->
        <div v-if="step === 3" class="space-y-4 py-2">
          <div>
            <h3 class="text-base font-medium">
              {{ t("dashboard.agents.installTitle") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t("dashboard.agents.installSubtitle") }}
            </p>
          </div>
          <div class="rounded-md border overflow-hidden">
            <Codemirror
              :model-value="installScript"
              :extensions="editorExtensions"
              :disabled="true"
              :style="{ minHeight: '120px' }"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t("dashboard.agents.onlineHint") }}
          </p>
        </div>

        <!-- Step 4: 完成 -->
        <div
          v-if="step === 4"
          class="flex flex-col items-center justify-center py-8 gap-4"
        >
          <CircleCheckBig class="h-16 w-16 text-green-500" />
          <h3 class="text-xl font-semibold">
            {{ t("dashboard.agents.completed") }}
          </h3>
        </div>
      </div>

      <DialogFooter class="px-6 pb-6 pt-2">
        <template v-if="step === 1">
          <Button :disabled="!canNext" @click="handleNext">
            {{ t("dashboard.agents.next") }}
          </Button>
        </template>
        <template v-else-if="step === 2">
          <Button variant="outline" @click="handlePrev">
            {{ t("dashboard.agents.prev") }}
          </Button>
          <Button :disabled="!canNext" @click="handleNext">
            {{ t("dashboard.agents.next") }}
          </Button>
        </template>
        <template v-else-if="step === 3">
          <Button variant="outline" @click="handlePrev">
            {{ t("dashboard.agents.prev") }}
          </Button>
          <Button v-if="!isOnline" disabled>
            <Loader2 class="h-4 w-4 mr-1.5 animate-spin" />
            {{ t("dashboard.agents.waitingOnline") }}
          </Button>
          <Button v-else @click="handleNext">
            {{ t("dashboard.agents.next") }}
          </Button>
        </template>
        <template v-else-if="step === 4">
          <Button variant="outline" @click="handleContinueAdding">
            {{ t("dashboard.agents.continueAdding") }}
          </Button>
          <Button @click="handleAdjustNode">
            {{ t("dashboard.agents.adjustNode") }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
