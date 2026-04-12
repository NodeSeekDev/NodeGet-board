<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useI18n } from "vue-i18n";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const { currentBackend } = useBackendStore();

const loading = ref(false);
const saveLoading = ref(false);

// 基本配置
const configLogLevel = ref("info");
const configIpInfoSource = ref("Ipinfo");
const configReportInterval = ref(60);
const configTerminalShell = ref("bash");
const configExecMaxLength = ref<number | undefined>(undefined);
const configConnectionTimeout = ref<number | undefined>(undefined);

// 特性开关
const featureIcmpPing = ref(true);
const featureTcpPing = ref(true);
const featureHttpPing = ref(true);
const featureHttpRequest = ref(true);
const featureWebShell = ref(true);
const featureExecute = ref(true);
const featureReadConfig = ref(true);
const featureEditConfig = ref(true);
const featureTask = ref(true);

// IP 信息来源
const allowIp = ref("");

// task 轮询
async function pollTaskResult(
  taskId: number,
  maxAttempts = 15,
): Promise<Record<string, unknown> | null> {
  if (!currentBackend.value) return null;
  const conn = getWsConnection(currentBackend.value.url);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const result = await conn.call<
        Array<{
          task_id: number;
          success: boolean;
          task_event_result: Record<string, unknown>;
          task_event_type: Record<string, unknown>;
        }>
      >("task_query", {
        token: currentBackend.value.token,
        task_data_query: {
          condition: [{ task_id: taskId }, "last"],
        },
      });
      if (Array.isArray(result) && result.length > 0) {
        const entry = result[0]!;
        if (entry.success !== false && entry.task_event_result) {
          return entry.task_event_result;
        }
      }
    } catch {
      // retry
    }
  }
  return null;
}

onMounted(async () => {
  if (!currentBackend.value) return;
  loading.value = true;
  try {
    const conn = getWsConnection(currentBackend.value.url);

    // 创建 read_config task
    const createResult = await conn.call<{ id: number }>("task_create_task", {
      token: currentBackend.value.token,
      target_uuid: props.uuid,
      task_type: "read_config",
    });

    const taskId = createResult?.id;
    if (!taskId) {
      loading.value = false;
      return;
    }

    // 轮询获取结果
    const taskResult = await pollTaskResult(taskId);
    const configStr = taskResult?.["read_config"];
    if (typeof configStr === "string") {
      parseConfig(configStr);
    }
  } catch {
    // use defaults
  } finally {
    loading.value = false;
  }
});

// 简易 TOML 解析（仅处理扁平 key = value）
function parseConfig(toml: string) {
  const lines = toml.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawValue = trimmed.slice(eqIdx + 1).trim();
    const value = rawValue.replace(/^"|"$/g, "");

    switch (key) {
      case "log_level":
        configLogLevel.value = value;
        break;
      case "ip_info_source":
        configIpInfoSource.value = value;
        break;
      case "report_interval":
        configReportInterval.value = Number(value);
        break;
      case "terminal_shell":
        configTerminalShell.value = value;
        break;
      case "exec_max_length":
        configExecMaxLength.value = Number(value);
        break;
      case "connection_timeout":
        configConnectionTimeout.value = Number(value);
        break;
      case "allow_icmp_ping":
        featureIcmpPing.value = value === "true";
        break;
      case "allow_tcp_ping":
        featureTcpPing.value = value === "true";
        break;
      case "allow_http_ping":
        featureHttpPing.value = value === "true";
        break;
      case "allow_http_request":
        featureHttpRequest.value = value === "true";
        break;
      case "allow_web_shell":
        featureWebShell.value = value === "true";
        break;
      case "allow_execute":
        featureExecute.value = value === "true";
        break;
      case "allow_read_config":
        featureReadConfig.value = value === "true";
        break;
      case "allow_edit_config":
        featureEditConfig.value = value === "true";
        break;
      case "allow_task":
        featureTask.value = value === "true";
        break;
      case "allow_ip":
        allowIp.value = value;
        break;
    }
  }
}

// 构建 TOML 字符串
function buildConfigToml(): string {
  const lines = [
    `log_level = "${configLogLevel.value}"`,
    `ip_info_source = "${configIpInfoSource.value}"`,
    `report_interval = ${configReportInterval.value}`,
    `terminal_shell = "${configTerminalShell.value}"`,
  ];
  if (configExecMaxLength.value !== undefined) {
    lines.push(`exec_max_length = ${configExecMaxLength.value}`);
  }
  if (configConnectionTimeout.value !== undefined) {
    lines.push(`connection_timeout = ${configConnectionTimeout.value}`);
  }
  lines.push(
    `allow_icmp_ping = ${featureIcmpPing.value}`,
    `allow_tcp_ping = ${featureTcpPing.value}`,
    `allow_http_ping = ${featureHttpPing.value}`,
    `allow_http_request = ${featureHttpRequest.value}`,
    `allow_web_shell = ${featureWebShell.value}`,
    `allow_execute = ${featureExecute.value}`,
    `allow_read_config = ${featureReadConfig.value}`,
    `allow_edit_config = ${featureEditConfig.value}`,
    `allow_task = ${featureTask.value}`,
  );
  if (allowIp.value) {
    lines.push(`allow_ip = "${allowIp.value}"`);
  }
  return lines.join("\n");
}

async function handleSave() {
  if (!currentBackend.value) return;
  saveLoading.value = true;
  try {
    const conn = getWsConnection(currentBackend.value.url);
    const configToml = buildConfigToml();

    // 创建 edit_config task
    const createResult = await conn.call<{ id: number }>("task_create_task", {
      token: currentBackend.value.token,
      target_uuid: props.uuid,
      task_type: { edit_config: configToml },
    });

    const taskId = createResult?.id;
    if (!taskId) {
      toast.error(t("dashboard.saveFailed"));
      saveLoading.value = false;
      return;
    }

    // 轮询获取结果
    const taskResult = await pollTaskResult(taskId);
    const editResult = taskResult?.["edit_config"];
    if (editResult === true) {
      toast.success(t("dashboard.saveSuccess"));
    } else {
      toast.error(t("dashboard.saveFailed"));
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    saveLoading.value = false;
  }
}

// allow_edit_config 禁用确认
const editConfigConfirmOpen = ref(false);
function handleEditConfigToggle(checked: boolean) {
  if (!checked) {
    editConfigConfirmOpen.value = true;
  } else {
    featureEditConfig.value = true;
  }
}
function confirmDisableEditConfig() {
  featureEditConfig.value = false;
  editConfigConfirmOpen.value = false;
}
</script>

<template>
  <div class="max-w-lg space-y-5">
    <div
      v-if="loading"
      class="flex items-center gap-2 text-muted-foreground text-sm py-4"
    >
      <Loader2 class="h-4 w-4 animate-spin" />
      {{ $t("common.loading") }}
    </div>

    <template v-else>
      <!-- 日志等级 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.logLevel") }}</Label>
        <Select v-model="configLogLevel">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">info</SelectItem>
            <SelectItem value="debug">debug</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
            <SelectItem value="error">error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- IP 信息来源 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.ipInfoSource") }}</Label>
        <Select v-model="configIpInfoSource">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ipinfo">Ipinfo</SelectItem>
            <SelectItem value="Cloudflare">Cloudflare</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- 上报间隔 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.reportInterval") }}</Label>
        <div class="flex items-center gap-2">
          <NumberField v-model="configReportInterval" :min="1" class="w-32" />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.reportIntervalUnit") }}
          </span>
        </div>
      </div>

      <!-- 启用特性 -->
      <div class="space-y-2">
        <Label>{{ $t("dashboard.node.config.enabledFeatures") }}</Label>

        <!-- 当 allow_task 开启时显示其他特性 -->
        <div v-if="featureTask" class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureIcmpPing")
            }}</span>
            <Switch v-model:checked="featureIcmpPing" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureTcpPing")
            }}</span>
            <Switch v-model:checked="featureTcpPing" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureHttpPing")
            }}</span>
            <Switch v-model:checked="featureHttpPing" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureHttpRequest")
            }}</span>
            <Switch v-model:checked="featureHttpRequest" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureWebShell")
            }}</span>
            <Switch v-model:checked="featureWebShell" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureExecute")
            }}</span>
            <Switch v-model:checked="featureExecute" />
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureIp")
            }}</span>
            <Input v-model="allowIp" placeholder="auto" class="w-32 h-8" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureReadConfig")
            }}</span>
            <Switch v-model:checked="featureReadConfig" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureEditConfig")
            }}</span>
            <PopConfirm
              :title="$t('dashboard.node.config.featureEditConfigConfirmTitle')"
              :description="
                $t('dashboard.node.config.featureEditConfigConfirmDesc')
              "
              @confirm="confirmDisableEditConfig"
            >
              <Switch
                :checked="featureEditConfig"
                :disabled="!featureEditConfig"
              />
            </PopConfirm>
          </div>
        </div>

        <!-- allow_task 放在最后 -->
        <div class="flex items-center justify-between pt-1 border-t">
          <span class="text-sm font-medium">{{
            $t("dashboard.node.config.featureTask")
          }}</span>
          <Switch v-model:checked="featureTask" />
        </div>
      </div>

      <!-- Terminal Shell -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.terminalShell") }}</Label>
        <Select v-model="configTerminalShell">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bash">bash</SelectItem>
            <SelectItem value="sh">sh</SelectItem>
            <SelectItem value="zsh">zsh</SelectItem>
            <SelectItem value="fish">fish</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- exec 最大返回长度 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.execMaxLength") }}</Label>
        <NumberField
          :model-value="configExecMaxLength"
          :min="0"
          class="w-32"
          @update:model-value="configExecMaxLength = $event"
        />
      </div>

      <!-- 连接超时 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.connectionTimeout") }}</Label>
        <div class="flex items-center gap-2">
          <NumberField
            :model-value="configConnectionTimeout"
            :min="0"
            class="w-32"
            @update:model-value="configConnectionTimeout = $event"
          />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.reportIntervalUnit") }}
          </span>
        </div>
      </div>

      <div class="pt-2">
        <Button
          :disabled="saveLoading || !featureEditConfig"
          @click="handleSave"
        >
          <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
          {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
        </Button>
      </div>
    </template>
  </div>
</template>
