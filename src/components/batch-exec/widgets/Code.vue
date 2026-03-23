<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from "vue";
import { Textarea } from "@/components/ui/textarea";

import { useI18n } from "vue-i18n";
const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  codeTips: boolean;
}>();

const emits = defineEmits<{
  (e: "update:modelValue", val: string): void;
}>();

const code = ref(props.modelValue);

const textareaRef = ref<InstanceType<typeof Textarea> | null>(null);

const warningHeight = ref("0px");

function updateWarningHeight() {
  if (textareaRef.value) {
    const rect = textareaRef.value.$el.offsetHeight;
    warningHeight.value = `${rect}px`;
  }
}

type RuleResult = { type: "danger" | "error" | "warn"; text: string };

const rules: { name: string; check: (line: string) => RuleResult | null }[] = [
  {
    name: "高危命令检测",
    check: (line: string) => {
      const dangerousCommands = [
        /rm\s+-rf\s+\//,
        /\bshutdown\b/,
        /\breboot\b/,
        /\bmkfs\b/,
        /\bformat\b/,
        /del\s+\/S\s+\/Q/,
      ];
      for (const regex of dangerousCommands) {
        if (regex.test(line)) {
          return {
            type: "danger",
            text: `${t("dashboard.batchExec.dangerousCommand")} ${line.trim()}`,
          };
        }
      }
      return null;
    },
  },
  {
    name: "斜杠后空格检测",
    check: (line: string) => {
      const slashIndex = line.indexOf("/");
      if (slashIndex !== -1 && /\/\s+$/.test(line)) {
        return {
          type: "error",
          text: `${t("dashboard.batchExec.warningCommand")} ${t("dashboard.batchExec.noSpaceAfterSlash")}`,
        };
      }
      return null;
    },
  },
  // more
];

const warnings = ref<{ line: number; text: RuleResult }[]>([]);

function analyzeCode(input: string) {
  const result: { line: number; text: RuleResult }[] = [];

  input.split("\n").forEach((line, index) => {
    rules.forEach((rule) => {
      const checkResult = rule.check(line);
      if (checkResult) {
        result.push({ line: index + 1, text: checkResult });
      }
    });
  });

  warnings.value = result;
}

watch(code, async (val) => {
  emits("update:modelValue", val);
  analyzeCode(val);
  await nextTick();
  updateWarningHeight();
});

const allWarnings = computed(() => warnings.value);

const levelStyles: Record<RuleResult["type"], string> = {
  danger: "text-red-600",
  error: "text-yellow-600",
  warn: "text-blue-600",
};

onMounted(async () => {
  await nextTick();
  updateWarningHeight();
});
</script>

<template>
  <div class="text-muted-foreground relative flex flex-col md:flex-row">
    <Textarea
      v-model="code"
      class="font-mono text-sm flex-1 resize-none"
      :placeholder="$t('dashboard.batchExec.enterCode')"
      ref="textareaRef"
      :rows="6"
    />
    <div
      class="space-y-1 md:w-50 w-full ml-0 md:ml-4 mt-2 md:mt-0 text-xs overflow-auto border border-gray-200 p-2 rounded-md flex flex-col"
      :style="{ height: warningHeight }"
      v-if="codeTips"
    >
      <div
        v-for="(w, idx) in allWarnings"
        :key="idx"
        :class="levelStyles[w.text.type]"
      >
        Line {{ w.line }} : {{ w.text.text }}
      </div>
    </div>
  </div>
</template>
