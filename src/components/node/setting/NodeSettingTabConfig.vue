<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKv } from "@/composables/useKv";
import { useI18n } from "vue-i18n";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const kv = useKv();

const loading = ref(false);
const saveLoading = ref(false);

const configLogLevel = ref("info");
const configIpInfoSource = ref("ipinfo");
const configReportInterval = ref(60);
const configTerminalShell = ref("bash");
const configExecMaxLength = ref<number | undefined>(undefined);
const configConnectionTimeout = ref<number | undefined>(undefined);

const featureTask = ref(true);
const featureIcmpPing = ref(true);
const featureTcpPing = ref(true);
const featureHttpPing = ref(true);

onMounted(async () => {
  loading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const results = await kv.getMultiValue([
      { namespace: props.uuid, key: "config_*" },
    ]);
    const get = (key: string) => results.find((r) => r.key === key)?.value;

    if (get("config_log_level") !== undefined)
      configLogLevel.value = String(get("config_log_level"));
    if (get("config_ip_info_source") !== undefined)
      configIpInfoSource.value = String(get("config_ip_info_source"));
    if (get("config_report_interval") !== undefined)
      configReportInterval.value = Number(get("config_report_interval"));
    if (get("config_terminal_shell") !== undefined)
      configTerminalShell.value = String(get("config_terminal_shell"));
    if (get("config_exec_max_length") !== undefined)
      configExecMaxLength.value = Number(get("config_exec_max_length"));
    if (get("config_connection_timeout") !== undefined)
      configConnectionTimeout.value = Number(get("config_connection_timeout"));
    if (get("config_feature_task") !== undefined)
      featureTask.value = Boolean(get("config_feature_task"));
    if (get("config_feature_icmp_ping") !== undefined)
      featureIcmpPing.value = Boolean(get("config_feature_icmp_ping"));
    if (get("config_feature_tcp_ping") !== undefined)
      featureTcpPing.value = Boolean(get("config_feature_tcp_ping"));
    if (get("config_feature_http_ping") !== undefined)
      featureHttpPing.value = Boolean(get("config_feature_http_ping"));
  } catch {
    // use defaults
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  saveLoading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const items: { key: string; value: unknown }[] = [
      { key: "config_log_level", value: configLogLevel.value },
      { key: "config_ip_info_source", value: configIpInfoSource.value },
      { key: "config_report_interval", value: configReportInterval.value },
      { key: "config_terminal_shell", value: configTerminalShell.value },
      { key: "config_feature_task", value: featureTask.value },
      { key: "config_feature_icmp_ping", value: featureIcmpPing.value },
      { key: "config_feature_tcp_ping", value: featureTcpPing.value },
      { key: "config_feature_http_ping", value: featureHttpPing.value },
    ];
    if (configExecMaxLength.value !== undefined)
      items.push({
        key: "config_exec_max_length",
        value: configExecMaxLength.value,
      });
    if (configConnectionTimeout.value !== undefined)
      items.push({
        key: "config_connection_timeout",
        value: configConnectionTimeout.value,
      });

    const { partialFailures } = await kv.setValueBatch(items);
    if (partialFailures.length > 0) {
      toast.warning(`Partial save failure: ${partialFailures.join(", ")}`);
    } else {
      toast.success(t("dashboard.saveSuccess"));
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    saveLoading.value = false;
  }
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
            <SelectItem value="ipinfo">ipinfo</SelectItem>
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
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm">{{
              $t("dashboard.node.config.featureTask")
            }}</span>
            <Switch v-model:checked="featureTask" />
          </div>
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
        <Button :disabled="saveLoading" @click="handleSave">
          <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
          {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
        </Button>
      </div>
    </template>
  </div>
</template>
