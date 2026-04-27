<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useKv } from "@/composables/useKv";
import { useI18n } from "vue-i18n";
import { useCron, taskToCronType } from "@/composables/useCron";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const kv = useKv();
const cron = useCron();

const loading = ref(false);
const saveLoading = ref(false);
const cleanLoading = ref(false);

const storageDynamicSummary = ref<number | undefined>(undefined);
const storageDynamic = ref<number | undefined>(undefined);
const storageStatic = ref<number | undefined>(undefined);
const storageAgentTask = ref<number | undefined>(undefined);

let cleanCronName = "periodic-cleanup";

const oneMinute = 60 * 1000;
function tsToMinute(value: unknown) {
  if (typeof value === "number") {
    return value / oneMinute;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return parseInt(value) / oneMinute;
  }
}
const minute2Ts = (t: typeof storageAgentTask.value) => {
  const oneMinute = 60 * 1000; // ms
  if (typeof t == "undefined") {
    return undefined;
  }
  return t * oneMinute;
};

onMounted(async () => {
  loading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const results = await kv.getMultiValue([
      { namespace: props.uuid, key: "database_limit_*" },
    ]);
    const get = (key: string) => results.find((r) => r.key === key)?.value;

    if (get("database_limit_dynamic_monitoring_summary") !== undefined)
      storageDynamicSummary.value = tsToMinute(
        get("database_limit_dynamic_monitoring_summary"),
      );
    if (get("database_limit_dynamic_monitoring") !== undefined)
      storageDynamic.value = tsToMinute(
        get("database_limit_dynamic_monitoring"),
      );
    if (get("database_limit_static_monitoring") !== undefined)
      storageStatic.value = tsToMinute(get("database_limit_static_monitoring"));
    if (get("database_limit_task") !== undefined)
      storageAgentTask.value = tsToMinute(get("database_limit_task"));
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  saveLoading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const items: { key: string; value: unknown }[] = [];

    if (storageDynamicSummary.value !== undefined)
      items.push({
        key: "database_limit_dynamic_monitoring_summary",
        value: minute2Ts(storageDynamicSummary.value),
      });
    if (storageDynamic.value !== undefined)
      items.push({
        key: "database_limit_dynamic_monitoring",
        value: minute2Ts(storageDynamic.value),
      });
    if (storageStatic.value !== undefined)
      items.push({
        key: "database_limit_static_monitoring",
        value: minute2Ts(storageStatic.value),
      });
    if (storageAgentTask.value !== undefined)
      items.push({
        key: "database_limit_task",
        value: minute2Ts(storageAgentTask.value),
      });

    if (items.length === 0) {
      toast.success(t("dashboard.saveSuccess"));
      return;
    }

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

async function cleanExpiredData() {
  try {
    cleanLoading.value = true;
    const tempName = crypto.randomUUID();
    await cron.create({
      name: tempName, // temp name
      cron_expression: "* * * * * *",
      cron_type: {
        server: "clean_up_database",
      },
    });
    await new Promise((r) => setTimeout(r, 2000));
    await cron.remove(tempName);
    toast.success(t("dashboard.node.storage.cleanSuccess"));
  } catch (error) {
    if (error instanceof Error) toast.error(error.toString());
  } finally {
    cleanLoading.value = false;
  }
}
async function handleCleanData() {
  cleanLoading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const saved = {
      static: storageStatic.value,
      dynamic: storageDynamic.value,
      agentTask: storageAgentTask.value,
    };

    await kv.setValueBatch([
      { key: "database_limit_static_monitoring", value: 0 },
      { key: "database_limit_dynamic_monitoring", value: 0 },
      { key: "database_limit_agent_task", value: 0 },
    ]);

    await new Promise((r) => setTimeout(r, 2000));

    const restoreItems: { key: string; value: unknown }[] = [];
    if (saved.static !== undefined)
      restoreItems.push({
        key: "database_limit_static_monitoring",
        value: saved.static,
      });
    if (saved.dynamic !== undefined)
      restoreItems.push({
        key: "database_limit_dynamic_monitoring",
        value: saved.dynamic,
      });
    if (saved.agentTask !== undefined)
      restoreItems.push({
        key: "database_limit_agent_task",
        value: saved.agentTask,
      });

    if (restoreItems.length > 0) {
      await kv.setValueBatch(restoreItems);
    }

    toast.success(t("dashboard.node.storage.cleanSuccess"));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    cleanLoading.value = false;
  }
}
</script>

<template>
  <div class="max-w-lg space-y-4">
    <!-- 储存周期设置 -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          {{ $t("dashboard.node.storage.title") }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          v-if="loading"
          class="flex items-center gap-2 text-muted-foreground text-sm py-2"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          {{ $t("common.loading") }}
        </div>
        <div v-else class="space-y-3">
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm">{{
              $t("dashboard.agents.dynamicMonitoringSummary")
            }}</span>
            <div class="flex items-center gap-1.5">
              <NumberField
                :model-value="storageDynamicSummary"
                :min="0"
                class="w-36"
                @update:model-value="storageDynamicSummary = $event"
              />
              <span class="text-sm text-muted-foreground whitespace-nowrap">
                {{ $t("dashboard.agents.minuteUnit") }}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm">{{
              $t("dashboard.agents.dynamicMonitoring")
            }}</span>
            <div class="flex items-center gap-1.5">
              <NumberField
                :model-value="storageDynamic"
                :min="0"
                class="w-36"
                @update:model-value="storageDynamic = $event"
              />
              <span class="text-sm text-muted-foreground whitespace-nowrap">
                {{ $t("dashboard.agents.minuteUnit") }}
              </span>
            </div>
          </div>

          <!-- no need to change -->
          <div class="flex items-center justify-between gap-4" v-if="false">
            <span class="text-sm">{{
              $t("dashboard.agents.staticMonitoring")
            }}</span>
            <div class="flex items-center gap-1.5">
              <NumberField
                :model-value="storageStatic"
                :min="0"
                class="w-36"
                @update:model-value="storageStatic = $event"
              />
              <span class="text-sm text-muted-foreground whitespace-nowrap">
                {{ $t("dashboard.agents.minuteUnit") }}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm">{{ $t("dashboard.agents.agentTask") }}</span>
            <div class="flex items-center gap-1.5">
              <NumberField
                :model-value="storageAgentTask"
                :min="0"
                class="w-36"
                @update:model-value="storageAgentTask = $event"
              />
              <span class="text-sm text-muted-foreground whitespace-nowrap">
                {{ $t("dashboard.agents.minuteUnit") }}
              </span>
            </div>
          </div>
          <div class="pt-2">
            <Button :disabled="saveLoading" @click="handleSave">
              <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
              {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 立即清理数据 -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          {{ $t("dashboard.node.storage.cleanTitle") }}
        </CardTitle>
        <CardDescription>
          {{ $t("dashboard.node.storage.cleanDesc") }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PopConfirm
          :title="$t('dashboard.node.storage.cleanTitle')"
          :description="$t('dashboard.node.storage.cleanDesc')"
          :confirm-text="$t('dashboard.node.storage.cleanConfirm')"
          :cancel-text="$t('dashboard.node.storage.cleanCancel')"
          :loading="cleanLoading"
          @confirm="cleanExpiredData"
        >
          <Button variant="destructive" :disabled="cleanLoading">
            <Loader2 v-if="cleanLoading" class="h-4 w-4 animate-spin mr-2" />
            {{
              cleanLoading
                ? $t("dashboard.node.storage.cleaning")
                : $t("dashboard.node.storage.cleanButton")
            }}
          </Button>
        </PopConfirm>
      </CardContent>
    </Card>
  </div>
</template>
