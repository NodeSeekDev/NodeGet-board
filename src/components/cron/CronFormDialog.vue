<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2 } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import CronNodeSelectDialog from "./CronNodeSelectDialog.vue";
import type { CronTask, AgentTaskKind } from "@/composables/useCron";

export type { CronTask, AgentTaskKind };

const props = defineProps<{
  open: boolean;
  task?: CronTask | null;
  mode?: "create" | "edit" | "duplicate";
  nodes: { uuid: string; customName: string }[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [task: Omit<CronTask, "id"> & { id?: number }];
}>();

const { t } = useI18n();

const isEditMode = computed(() => props.mode === "edit" && !!props.task);

const defaultForm = () => ({
  name: "",
  cronExpression: "",
  taskKind: "agent" as "agent" | "server",
  agentIds: [] as string[],
  agentTaskType: "ping" as AgentTaskKind,
  agentTaskTarget: "",
  agentExecuteCommand: "",
  agentExecuteArgsText: "",
  serverTask: "clean_up_database",
});

const form = ref(defaultForm());
const errors = ref<Record<string, string>>({});
const nodeSelectOpen = ref(false);
const executeExamplePayload = '{"execute":{"cmd":"ls","args":["-1","tmp"]}}';

const cronFieldDefs = [
  { min: 0, max: 59, label: "dashboard.cron.seconds" },
  { min: 0, max: 59, label: "dashboard.cron.minutes" },
  { min: 0, max: 23, label: "dashboard.cron.hours" },
  { min: 1, max: 31, label: "dashboard.cron.days" },
  { min: 1, max: 12, label: "dashboard.cron.months" },
  { min: 0, max: 7, label: "dashboard.cron.weekdays" },
] as const;

const splitCompactCron = (value: string) => {
  if (/^[\d*?]{1,6}$/.test(value)) return value.split("");
  return [value];
};

const sanitizeCronExpressionInput = (value: string) => {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (!compacted) return "";

  const tokens = compacted.includes(" ")
    ? compacted.split(" ").filter(Boolean)
    : splitCompactCron(compacted);

  return tokens.slice(0, 6).join(" ");
};

const normalizeCronExpression = (value: string) => {
  const sanitized = sanitizeCronExpressionInput(value);
  if (!sanitized) return "";

  const tokens = sanitized.split(" ").filter(Boolean).slice(0, 6);
  while (tokens.length < 6) tokens.push("*");
  return tokens.join(" ");
};

const validateCronSegment = (
  segment: string,
  min: number,
  max: number,
): boolean => {
  if (segment === "*" || segment === "?") return true;
  if (/^\d+$/.test(segment)) {
    const value = Number(segment);
    return value >= min && value <= max;
  }
  if (/^\*\/\d+$/.test(segment)) return Number(segment.slice(2)) > 0;
  if (/^\d+\/\d+$/.test(segment)) {
    const [start = Number.NaN, step = Number.NaN] = segment
      .split("/")
      .map(Number);
    return start >= min && start <= max && step > 0;
  }
  if (/^\d+-\d+$/.test(segment)) {
    const [start = Number.NaN, end = Number.NaN] = segment
      .split("-")
      .map(Number);
    return start >= min && end <= max && start <= end;
  }
  if (/^\d+(,\d+)+$/.test(segment)) {
    return segment.split(",").every((part) => {
      const value = Number(part);
      return value >= min && value <= max;
    });
  }
  return false;
};

const cronPresets = computed(() => [
  {
    label: t("dashboard.cron.presetEveryMinute"),
    value: "0 * * * * *",
    description: "每分钟执行",
  },
  {
    label: t("dashboard.cron.presetEveryHour"),
    value: "0 0 * * * *",
    description: "每小时执行",
  },
  {
    label: t("dashboard.cron.presetEveryDay"),
    value: "0 0 0 * * *",
    description: "每天午夜执行",
  },
  {
    label: t("dashboard.cron.presetEveryWeek"),
    value: "0 0 0 * * 0",
    description: "每周日凌晨执行",
  },
]);

const applyPreset = (expression: string) => {
  form.value.cronExpression = expression;
};

const getFieldValidationHint = (fieldName: string, token: string): string => {
  if (token === "?") {
    return t("dashboard.cron.hintQuestionMark");
  }
  if (/^\d+$/.test(token)) {
    const num = Number(token);
    if (isNaN(num)) {
      return t("dashboard.cron.hintGeneral");
    }
    return t("dashboard.cron.hintNumberRange");
  }
  if (/^\*\/\d+$/.test(token)) {
    const step = Number(token.slice(2));
    if (step <= 0) {
      return t("dashboard.cron.hintStepPositive");
    }
    return t("dashboard.cron.hintStep");
  }
  if (/^\d+\/\d+$/.test(token)) {
    return t("dashboard.cron.hintStartStep");
  }
  if (/^\d+-\d+$/.test(token)) {
    return t("dashboard.cron.hintRange");
  }
  if (/^\d+(,\d+)+$/.test(token)) {
    return t("dashboard.cron.hintList");
  }
  return t("dashboard.cron.hintGeneral");
};

const getCronValidationMessage = (value: string) => {
  const normalized = normalizeCronExpression(value);
  if (!normalized) return t("dashboard.cron.expressionRequired");

  const tokens = normalized.split(" ");
  if (tokens.length !== 6) {
    return (
      t("dashboard.cron.expressionFieldCount") +
      " " +
      t("dashboard.cron.expressionFormatHint")
    );
  }

  for (const [index, token] of tokens.entries()) {
    const field = cronFieldDefs[index];
    if (!field) return t("dashboard.cron.expressionFieldCount");

    if (!validateCronSegment(token, field.min, field.max)) {
      const fieldName = t(field.label);
      const hint = getFieldValidationHint(fieldName, token);
      return (
        t("dashboard.cron.expressionInvalidField", {
          field: fieldName,
          value: token,
        }) + ` (${hint})`
      );
    }
  }

  return "";
};

const describeCronSegment = (segment: string, fieldLabel: string) => {
  if (segment === "*")
    return t("dashboard.cron.expressionEveryField", { field: fieldLabel });
  if (segment === "?")
    return t("dashboard.cron.expressionUnspecifiedField", {
      field: fieldLabel,
    });
  if (/^\d+$/.test(segment))
    return t("dashboard.cron.expressionExactField", {
      field: fieldLabel,
      value: segment,
    });
  if (/^\*\/\d+$/.test(segment)) {
    return t("dashboard.cron.expressionStepField", {
      field: fieldLabel,
      step: segment.slice(2),
    });
  }
  if (/^\d+\/\d+$/.test(segment)) {
    const [start, step] = segment.split("/");
    return t("dashboard.cron.expressionStartStepField", {
      field: fieldLabel,
      start,
      step,
    });
  }
  if (/^\d+-\d+$/.test(segment)) {
    const [start, end] = segment.split("-");
    return t("dashboard.cron.expressionRangeField", {
      field: fieldLabel,
      start,
      end,
    });
  }
  if (/^\d+(,\d+)+$/.test(segment)) {
    return t("dashboard.cron.expressionListField", {
      field: fieldLabel,
      values: segment,
    });
  }
  return t("dashboard.cron.expressionCustomField", {
    field: fieldLabel,
    value: segment,
  });
};

const cronExpressionNormalized = computed(() =>
  normalizeCronExpression(form.value.cronExpression),
);
const cronExpressionValidationMessage = computed(() =>
  getCronValidationMessage(form.value.cronExpression),
);
const cronExpressionMeaning = computed(() => {
  if (cronExpressionValidationMessage.value) return "";

  const tokens = cronExpressionNormalized.value.split(" ");
  return tokens
    .map((token, index) => {
      const field = cronFieldDefs[index];
      return describeCronSegment(
        token,
        t(field?.label ?? "dashboard.cron.expression"),
      );
    })
    .join("；");
});

const parseExecuteArgs = (value: string) => {
  const matches = value.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];
  return matches.map((part) => {
    if (
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith("'") && part.endsWith("'"))
    ) {
      return part.slice(1, -1);
    }
    return part;
  });
};

const stringifyExecuteArgs = (args: string[]) =>
  args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ");

const nodeNameMap = computed(
  () =>
    new Map(
      props.nodes.map((node) => [node.uuid, node.customName || node.uuid]),
    ),
);

const selectedNodeSummary = computed(() => {
  if (!form.value.agentIds.length) return t("dashboard.cron.noNodes");
  return form.value.agentIds
    .map((id) => nodeNameMap.value.get(id) ?? id)
    .join(", ");
});

const validateForm = (): boolean => {
  errors.value = {};

  if (!form.value.name.trim()) {
    errors.value.name = t("dashboard.cron.nameRequired");
  }

  if (!form.value.cronExpression.trim()) {
    errors.value.cronExpression = t("dashboard.cron.expressionRequired");
  } else if (cronExpressionValidationMessage.value) {
    errors.value.cronExpression = cronExpressionValidationMessage.value;
  }

  if (form.value.taskKind === "agent") {
    if (!form.value.agentIds.length) {
      errors.value.agentIds = t("dashboard.cron.nodesRequired");
    }

    if (form.value.agentTaskType === "execute") {
      if (!form.value.agentExecuteCommand.trim()) {
        errors.value.agentExecuteCommand = t(
          "dashboard.cron.execCommandRequired",
        );
      }
    } else {
      if (!form.value.agentTaskTarget.trim()) {
        errors.value.agentTaskTarget = t("dashboard.cron.taskTargetRequired");
      }
    }
  }

  return Object.keys(errors.value).length === 0;
};

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.task) {
        form.value = {
          name: props.mode === "duplicate" ? "" : props.task.name,
          cronExpression: props.task.cronExpression,
          taskKind: props.task.taskKind,
          agentIds: [...props.task.agentIds],
          agentTaskType: props.task.agentTaskType,
          agentTaskTarget: props.task.agentTaskTarget,
          agentExecuteCommand: props.task.agentExecuteCommand,
          agentExecuteArgsText: stringifyExecuteArgs(
            props.task.agentExecuteArgs,
          ),
          serverTask: props.task.serverTask || "clean_up_database",
        };
      } else {
        form.value = defaultForm();
      }
    }
  },
);

const handleNodeConfirm = (ids: string[]) => {
  form.value.agentIds = ids;
};

const handleSave = () => {
  if (props.saving) return;
  if (!validateForm()) return;
  emit("save", {
    id: isEditMode.value ? props.task?.id : undefined,
    name: form.value.name,
    cronExpression: form.value.cronExpression,
    enabled: props.task?.enabled ?? true,
    lastRunTime: isEditMode.value ? (props.task?.lastRunTime ?? null) : null,
    taskKind: form.value.taskKind,
    agentIds: form.value.agentIds,
    agentTaskType: form.value.agentTaskType,
    agentTaskTarget: form.value.agentTaskTarget,
    agentExecuteCommand: form.value.agentExecuteCommand,
    agentExecuteArgs: parseExecuteArgs(form.value.agentExecuteArgsText),
    serverTask: form.value.serverTask,
  });
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            isEditMode ? t("dashboard.cron.edit") : t("dashboard.cron.create")
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("dashboard.cron.desc") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.cron.name") }}</Label>
          <Input
            v-model="form.name"
            :placeholder="t('dashboard.cron.name')"
            :disabled="isEditMode || saving"
          />
          <p v-if="errors.name" class="text-xs text-destructive">
            {{ errors.name }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.cron.expression") }}</Label>

          <!-- 预设模板 -->
          <div class="flex flex-wrap gap-2">
            <Badge
              v-for="preset in cronPresets"
              :key="preset.value"
              variant="secondary"
              class="cursor-pointer hover:bg-primary/20 transition-colors"
              @click="applyPreset(preset.value)"
            >
              {{ preset.label }}
            </Badge>
          </div>

          <!-- 表达式输入框 -->
          <Input
            :model-value="form.cronExpression"
            placeholder="* * * * * *"
            class="font-mono"
            :disabled="saving"
            @update:model-value="
              form.cronExpression = sanitizeCronExpressionInput(String($event))
            "
            @blur="
              form.cronExpression = normalizeCronExpression(form.cronExpression)
            "
          />

          <!-- 使用说明 -->
          <div
            class="rounded-md border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
          >
            <p class="font-medium mb-1">
              {{ t("dashboard.cron.expressionSyntaxTitle") }}
            </p>
            <ul class="space-y-1">
              <li>
                • <code class="font-mono">* * * * * *</code> -
                {{ t("dashboard.cron.expressionFormat") }}
              </li>
              <li>
                • {{ t("dashboard.cron.expressionWildcard") }}:
                <code class="font-mono">*</code>
              </li>
              <li>
                • {{ t("dashboard.cron.expressionRange") }}:
                <code class="font-mono">1-5</code>
              </li>
              <li>
                • {{ t("dashboard.cron.expressionStep") }}:
                <code class="font-mono">*/5</code>
              </li>
              <li>
                • {{ t("dashboard.cron.expressionList") }}:
                <code class="font-mono">1,2,3</code>
              </li>
            </ul>
          </div>

          <!-- 语义对照 -->
          <div
            v-if="cronExpressionMeaning"
            class="rounded-md border bg-muted/60 px-3 py-2 text-xs"
          >
            <p class="font-medium mb-1">
              {{ t("dashboard.cron.expressionMeaningTitle") }}
            </p>
            <p class="text-muted-foreground">{{ cronExpressionMeaning }}</p>
          </div>

          <!-- 错误提示 -->
          <p v-if="errors.cronExpression" class="text-xs text-destructive">
            {{ errors.cronExpression }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.cron.type") }}</Label>
          <Select v-model="form.taskKind">
            <SelectTrigger class="w-full" :disabled="saving">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">{{
                t("dashboard.cron.agentTask")
              }}</SelectItem>
              <SelectItem value="server">{{
                t("dashboard.cron.serverTask")
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Agent 类型字段 -->
        <template v-if="form.taskKind === 'agent'">
          <div class="space-y-1.5">
            <Label>{{ t("dashboard.cron.nodes") }}</Label>
            <Button
              variant="outline"
              class="h-auto w-full justify-between gap-3 py-2"
              :disabled="saving"
              @click="nodeSelectOpen = true"
            >
              <div class="min-w-0 text-left">
                <div>{{ t("dashboard.cron.selectNodes") }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ selectedNodeSummary }}
                </div>
              </div>
              <span class="shrink-0 text-muted-foreground">{{
                form.agentIds.length
              }}</span>
            </Button>
            <p v-if="errors.agentIds" class="text-xs text-destructive">
              {{ errors.agentIds }}
            </p>
          </div>
          <div class="space-y-1.5">
            <Label>{{ t("dashboard.cron.taskLabel") }}</Label>
            <Select v-model="form.agentTaskType">
              <SelectTrigger class="w-full" :disabled="saving">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ping">ping</SelectItem>
                <SelectItem value="tcp_ping">tcp_ping</SelectItem>
                <SelectItem value="http_ping">http_ping</SelectItem>
                <SelectItem value="execute">execute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label>{{
              form.agentTaskType === "execute"
                ? t("dashboard.cron.execCommand")
                : t("dashboard.cron.taskTarget")
            }}</Label>
            <Input
              v-if="form.agentTaskType === 'execute'"
              v-model="form.agentExecuteCommand"
              placeholder="ls"
              :disabled="saving"
            />
            <Input
              v-else
              v-model="form.agentTaskTarget"
              :placeholder="
                form.agentTaskType === 'tcp_ping'
                  ? 'www.example.com:80'
                  : 'www.example.com'
              "
              :disabled="saving"
            />
            <p
              v-if="errors.agentExecuteCommand || errors.agentTaskTarget"
              class="text-xs text-destructive"
            >
              {{ errors.agentExecuteCommand || errors.agentTaskTarget }}
            </p>
          </div>
          <div v-if="form.agentTaskType === 'execute'" class="space-y-1.5">
            <Label>{{ t("dashboard.cron.execArgs") }}</Label>
            <Input
              v-model="form.agentExecuteArgsText"
              :placeholder="t('dashboard.cron.execArgsPlaceholder')"
              :disabled="saving"
            />
          </div>
          <div
            v-if="form.agentTaskType === 'execute'"
            class="rounded-md border bg-muted/60 px-3 py-2 text-xs text-muted-foreground space-y-1"
          >
            <p>{{ t("dashboard.cron.execGuide") }}</p>
            <p class="font-mono text-[11px]">
              {{
                t("dashboard.cron.execGuideExample", {
                  payload: executeExamplePayload,
                })
              }}
            </p>
          </div>
        </template>

        <!-- Server 类型字段 -->
        <template v-else>
          <div class="space-y-1.5">
            <Label>{{ t("dashboard.cron.serverTaskType") }}</Label>
            <Select v-model="form.serverTask">
              <SelectTrigger class="w-full" :disabled="saving">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clean_up_database"
                  >clean_up_database</SelectItem
                >
              </SelectContent>
            </Select>
          </div>
        </template>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="emit('update:open', false)"
          >{{ t("dashboard.cron.cancel") }}</Button
        >
        <Button
          :disabled="saving || !!cronExpressionValidationMessage"
          @click="handleSave"
        >
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          {{ saving ? t("dashboard.saving") : t("dashboard.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <CronNodeSelectDialog
    v-model:open="nodeSelectOpen"
    :selected-ids="form.agentIds"
    :nodes="nodes"
    @confirm="handleNodeConfirm"
  />
</template>
