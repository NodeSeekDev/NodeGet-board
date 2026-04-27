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
  useAgentConfig,
  type AgentConfig,
  type UpstreamServer,
  type splitConfig,
} from "@/composables/useAgentConfig";
import { delay } from "@/lib/delay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "vue-i18n";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const { getAgentConfigExtra, writeAgentConfig } = useAgentConfig();

const loading = ref(false);
const saveLoading = ref(false);

// Agent 配置对象
const agentConfig = ref<splitConfig | null>(null);

// UI 绑定的临时变量
const logLevel = ref<"trace" | "debug" | "info" | "warn" | "error">("info");
const ipProvider = ref<"ipinfo" | "cloudflare">("ipinfo");
const dynamicSummaryReportInterval = ref(1000); // ms
const dynamicReportInterval = ref(1000); // ms
const staticReportInterval = ref(3600000); // ms
const terminalShell = ref<"bash" | "cmd">("bash");
const execMaxCharacter = ref<number | undefined>(undefined);
const connectTimeout = ref<number | undefined>(undefined);

// 特性开关 (server config中的allow_*属性)
const allowTask = ref(true);
const allowIcmpPing = ref(true);
const allowTcpPing = ref(true);
const allowHttpPing = ref(true);
const allowHttpRequest = ref(true);
const allowWebShell = ref(true);
const allowExecute = ref(true);
const allowReadConfig = ref(true);
const allowEditConfig = ref(true);
const allowIp = ref(true);

/**
 * 从 AgentConfig 对象更新 UI 状态
 */
function syncFromConfig(config: splitConfig) {
  const basicConfig = config.basicConfig;
  const currentUpstream = config.currentUpstream;
  logLevel.value = basicConfig.log_level || "info";
  ipProvider.value = basicConfig.ip_provider || "ipinfo";
  dynamicReportInterval.value = basicConfig.dynamic_report_interval_ms || 1000;
  dynamicSummaryReportInterval.value =
    basicConfig.dynamic_summary_report_interval_ms || 1000;
  staticReportInterval.value = basicConfig.static_report_interval_ms || 300000;
  terminalShell.value = basicConfig.terminal_shell || "bash";
  execMaxCharacter.value = basicConfig.exec_max_character;
  connectTimeout.value = basicConfig.connect_timeout_ms;

  // 从 server 配置中提取第一个 server 的 allow_* 属性
  if (currentUpstream) {
    allowTask.value = currentUpstream.allow_task !== false;
    allowIcmpPing.value = currentUpstream.allow_icmp_ping !== false;
    allowTcpPing.value = currentUpstream.allow_tcp_ping !== false;
    allowHttpPing.value = currentUpstream.allow_http_ping !== false;
    allowHttpRequest.value = currentUpstream.allow_http_request !== false;
    allowWebShell.value = currentUpstream.allow_web_shell !== false;
    allowExecute.value = currentUpstream.allow_execute !== false;
    allowReadConfig.value = currentUpstream.allow_read_config !== false;
    allowEditConfig.value = currentUpstream.allow_edit_config !== false;
    allowIp.value = currentUpstream.allow_edit_config !== false;
  }
}

/**
 * 从 UI 状态构建 AgentConfig 对象
 */
function buildConfig(): AgentConfig {
  if (!agentConfig.value) {
    throw new Error("Config not loaded");
  }
  if (dynamicReportInterval.value % dynamicSummaryReportInterval.value !== 0) {
    toast.error(
      "dynamicReportInterval must be an integer multiple of dynamicSummaryReportInterval",
    );
    throw new Error(
      "dynamicReportInterval must be an integer multiple of dynamicSummaryReportInterval",
    );
  }

  const config = JSON.parse(
    JSON.stringify({
      ...agentConfig.value.basicConfig,
      server: [],
    }),
  );

  config.log_level = logLevel.value;
  config.ip_provider = ipProvider.value;
  config.dynamic_report_interval_ms = dynamicReportInterval.value;
  config.dynamic_summary_report_interval_ms =
    dynamicSummaryReportInterval.value;
  config.static_report_interval_ms = staticReportInterval.value;
  config.terminal_shell = terminalShell.value;

  if (execMaxCharacter.value !== undefined) {
    config.exec_max_character = execMaxCharacter.value;
  }
  if (connectTimeout.value !== undefined) {
    config.connect_timeout_ms = connectTimeout.value;
  }

  const currentUpstreamNew: UpstreamServer = {
    ...agentConfig.value.currentUpstream,
    allow_task: allowTask.value,
    allow_icmp_ping: allowIcmpPing.value,
    allow_tcp_ping: allowTcpPing.value,
    allow_http_ping: allowHttpPing.value,
    allow_http_request: allowHttpRequest.value,
    allow_web_shell: allowWebShell.value,
    allow_execute: allowExecute.value,
    allow_read_config: allowReadConfig.value,
    allow_edit_config: allowEditConfig.value,
    allow_ip: !!allowIp.value,
  };

  return {
    ...config,
    server: [...agentConfig.value.otherUpstreams, currentUpstreamNew],
  };
}

/**
 * 加载 Agent 配置
 */
onMounted(async () => {
  loading.value = true;
  try {
    const config = await getAgentConfigExtra(props.uuid);
    agentConfig.value = config;
    // todo: find current backend, watch
    syncFromConfig(config);
  } catch (e: unknown) {
    toast.error(
      e instanceof Error ? e.message : t("dashboard.node.config.loadFailed"),
    );
  } finally {
    loading.value = false;
  }
});

/**
 * 保存配置
 */
async function handleSave() {
  saveLoading.value = true;
  try {
    const config = buildConfig();
    const success = await writeAgentConfig(props.uuid, config);

    if (success) {
      toast.success(t("dashboard.saveSuccess"));
      await delay(1000);
      agentConfig.value = await getAgentConfigExtra(props.uuid);
    } else {
      toast.error(t("dashboard.saveFailed"));
    }
  } catch (e: unknown) {
    toast.error(
      e instanceof Error ? e.message : t("dashboard.node.config.saveFailed"),
    );
  } finally {
    saveLoading.value = false;
  }
}

/**
 * 处理禁用 allow_edit_config
 */
function handleEditConfigToggle(checked: boolean) {
  if (!checked) {
    // 触发确认弹窗
    // 这里通过 PopConfirm 组件处理
  } else {
    allowEditConfig.value = true;
  }
}

function confirmDisableEditConfig() {
  allowEditConfig.value = false;
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
        <Select v-model="logLevel">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trace">trace</SelectItem>
            <SelectItem value="debug">debug</SelectItem>
            <SelectItem value="info">info</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
            <SelectItem value="error">error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- IP 提供商 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.ipProvider") }}</Label>
        <Select v-model="ipProvider">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ipinfo">Ipinfo</SelectItem>
            <SelectItem value="cloudflare">Cloudflare</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- 动态监控上报间隔 (ms) -->
      <div class="space-y-1.5">
        <Label>{{
          $t("dashboard.node.config.dynamicSummaryReportInterval")
        }}</Label>
        <div class="flex items-center gap-2">
          <NumberField
            v-model="dynamicSummaryReportInterval"
            :min="1000"
            class="w-40"
          />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.msUnit") }}
          </span>
        </div>
      </div>

      <!-- 动态监控上报间隔 (ms) -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.dynamicReportInterval") }}</Label>
        <div class="flex items-center gap-2">
          <NumberField
            v-model="dynamicReportInterval"
            :min="1000"
            class="w-40"
          />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.msUnit") }}
          </span>
        </div>
      </div>

      <!-- 静态监控上报间隔 (ms) -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.staticReportInterval") }}</Label>
        <div class="flex items-center gap-2">
          <NumberField
            v-model="staticReportInterval"
            :min="1000"
            class="w-40"
          />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.msUnit") }}
          </span>
        </div>
      </div>

      <!-- 连接超时 (ms) -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.connectTimeout") }}</Label>
        <div class="flex items-center gap-2">
          <NumberField
            :model-value="connectTimeout"
            :min="0"
            class="w-40"
            @update:model-value="connectTimeout = $event"
          />
          <span class="text-sm text-muted-foreground">
            {{ $t("dashboard.node.config.msUnit") }}
          </span>
        </div>
      </div>

      <!-- Terminal Shell -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.terminalShell") }}</Label>
        <Select v-model="terminalShell">
          <SelectTrigger class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bash">bash</SelectItem>
            <SelectItem value="cmd">cmd</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- exec 最大返回字符数 -->
      <div class="space-y-1.5">
        <Label>{{ $t("dashboard.node.config.execMaxCharacter") }}</Label>
        <NumberField
          :model-value="execMaxCharacter"
          :min="0"
          class="w-40"
          @update:model-value="execMaxCharacter = $event"
        />
      </div>

      <!-- 启用特性 -->
      <div class="space-y-2">
        <Label>{{ $t("dashboard.node.config.enabledFeatures") }}</Label>

        <!-- allow_task 放在最前面作为总开关 -->
        <div class="flex items-center justify-between pb-2 border-b">
          <span class="text-sm font-medium">{{
            $t("dashboard.node.config.featureTask")
          }}</span>
          <Switch v-model:modelValue="allowTask" />
        </div>

        <!-- 当 allow_task 开启时显示其他特性 -->
        <template v-if="allowTask">
          <div class="space-y-2 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureIcmpPing")
              }}</span>
              <Switch v-model:modelValue="allowIcmpPing" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureTcpPing")
              }}</span>
              <Switch v-model:modelValue="allowTcpPing" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureHttpPing")
              }}</span>
              <Switch v-model:modelValue="allowHttpPing" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureHttpRequest")
              }}</span>
              <Switch v-model:modelValue="allowHttpRequest" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureWebShell")
              }}</span>
              <Switch v-model:modelValue="allowWebShell" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureExecute")
              }}</span>
              <Switch v-model:modelValue="allowExecute" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureIp")
              }}</span>
              <Switch v-model:modelValue="allowIp" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureReadConfig")
              }}</span>
              <Switch v-model:modelValue="allowReadConfig" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">{{
                $t("dashboard.node.config.featureEditConfig")
              }}</span>
              <PopConfirm
                :title="
                  $t('dashboard.node.config.featureEditConfigConfirmTitle')
                "
                :description="
                  $t('dashboard.node.config.featureEditConfigConfirmDesc')
                "
                @confirm="confirmDisableEditConfig"
              >
                <Switch
                  :checked="allowEditConfig"
                  :disabled="!allowEditConfig"
                  @update:checked="handleEditConfigToggle"
                />
              </PopConfirm>
            </div>
          </div>
        </template>
      </div>

      <div class="pt-2">
        <Button :disabled="saveLoading" @click="handleSave">
          <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
          {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
        </Button>
      </div>
    </template>
  </div>
</template>
