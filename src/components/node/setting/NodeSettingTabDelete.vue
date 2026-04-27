<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Loader2, CheckCircle2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useKv } from "@/composables/useKv";
import { useBackendStore } from "@/composables/useBackendStore";
import { makeRpcFunction } from "@/composables/useWsConnection";
import { useLifecycle } from "@/composables/useLifecycle";
import { useI18n } from "vue-i18n";
import {
  useAgentConfig,
  type AgentConfig,
  type UpstreamServer,
  type splitConfig,
} from "@/composables/useAgentConfig";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const router = useRouter();
const kv = useKv();
const { currentBackend } = useBackendStore();
const { getAgentConfigExtra, writeAgentConfig } = useAgentConfig();
const { afterAgentDelete } = useLifecycle();

const nodeName = ref("");

onMounted(async () => {
  try {
    const results = await kv.getMultiValue([
      { namespace: props.uuid, key: "metadata_name" },
    ]);
    const entry = results.find((r) => r.key === "metadata_name");
    if (entry) nodeName.value = String(entry.value);
  } catch {
    // ignore
  }
});

const dialogOpen = ref(false);
const confirmName = ref("");
const progress = ref(0);
const activeStep = ref(0); // 0=idle
const stepStatus = ref<("idle" | "running" | "done")[]>([
  "idle",
  "idle",
  "idle",
  "idle",
]);

function openDialog() {
  confirmName.value = "";
  progress.value = 0;
  activeStep.value = 0;
  stepStatus.value = ["idle", "idle", "idle", "idle"];
  dialogOpen.value = true;
}

const confirmDisabled = () =>
  !confirmName.value ||
  confirmName.value !== nodeName.value ||
  activeStep.value > 0;

function setStep(i: number, status: "running" | "done") {
  stepStatus.value = stepStatus.value.map((s, idx) => (idx === i ? status : s));
  activeStep.value = i + 1;
  progress.value = Math.round(((i + (status === "done" ? 1 : 0)) / 4) * 100);
}

async function handleDelete() {
  const rpc = makeRpcFunction();

  if (confirmName.value !== nodeName.value) {
    toast.error(t("dashboard.node.delete.nameMismatch"));
    return;
  }

  // Step 1: delete token
  setStep(0, "running");
  try {
    const { currentUpstream } = await getAgentConfigExtra(props.uuid);
    // disable token, stop data report
    await rpc("token_delete", {
      token: currentBackend.value?.token,
      target_token: currentUpstream.token.split(":")[0],
    });

    // todo: delete server block
  } catch {
    // API may not be implemented yet, continue
  }
  setStep(0, "done");

  // Step 2: clean cron
  setStep(1, "running");
  try {
    await afterAgentDelete(props.uuid, "cron");
  } catch {
    // ignore
  }
  setStep(1, "done");

  // Step 3: clean KV namespace
  setStep(2, "running");
  try {
    await afterAgentDelete(props.uuid, "kv");
  } catch {
    // ignore
  }
  setStep(2, "done");

  // Step 4: clean monitor/report data
  setStep(3, "running");
  try {
    await afterAgentDelete(props.uuid, "data");
    await new Promise((r) => setTimeout(r, 300));
  } catch (error) {}
  setStep(3, "done");
  progress.value = 100;

  toast.success(t("dashboard.node.delete.success"));
  setTimeout(() => {
    dialogOpen.value = false;
    router.push("/dashboard/node-manage?tab=agents");
  }, 1200);
}
</script>

<template>
  <div class="max-w-lg space-y-4">
    <div>
      <h2 class="text-lg font-semibold">
        {{ $t("dashboard.node.delete.title") }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ $t("dashboard.node.delete.desc") }}
      </p>
      <ul
        class="mt-3 space-y-1 list-disc list-inside text-sm text-muted-foreground"
      >
        <li>{{ $t("dashboard.node.delete.step1") }}</li>
        <li>{{ $t("dashboard.node.delete.step2") }}</li>
        <li>{{ $t("dashboard.node.delete.step3") }}</li>
      </ul>
    </div>

    <Button variant="destructive" @click="openDialog">
      {{ $t("dashboard.node.delete.button") }}
    </Button>

    <AlertDialog v-model:open="dialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("dashboard.node.delete.confirmTitle") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("dashboard.node.delete.confirmDesc") }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <!-- 进度展示（执行中） -->
        <div v-if="activeStep > 0" class="space-y-3 py-2">
          <Progress :model-value="progress" class="h-2" />
          <div class="space-y-2">
            <div
              v-for="(stepKey, i) in ['step1', 'step2', 'step3', 'step4']"
              :key="stepKey"
              class="flex items-center gap-2 text-sm"
            >
              <Loader2
                v-if="stepStatus[i] === 'running'"
                class="h-4 w-4 animate-spin text-muted-foreground"
              />
              <CheckCircle2
                v-else-if="stepStatus[i] === 'done'"
                class="h-4 w-4 text-green-500"
              />
              <span
                v-else
                class="h-4 w-4 rounded-full border border-muted-foreground/30 inline-block"
              />
              <span
                :class="
                  stepStatus[i] === 'done'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                "
              >
                {{ $t(`dashboard.node.delete.${stepKey}`) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 确认输入框（未执行） -->
        <div v-else class="space-y-2 py-2">
          <Label>{{ $t("dashboard.node.delete.confirmPlaceholder") }}</Label>
          <Input
            v-model="confirmName"
            :placeholder="$t('dashboard.node.delete.confirmPlaceholder')"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="activeStep > 0"
            @click="dialogOpen = false"
          >
            {{ $t("dashboard.node.delete.cancel") }}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="confirmDisabled()"
            @click="handleDelete"
          >
            {{ $t("dashboard.node.delete.confirm") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
