<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ScanEye } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    errorMessage?: string;
  }>(),
  {
    errorMessage: "",
  },
);

const emits = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

const hasError = computed(() => props.errorMessage.trim().length > 0);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <ScanEye class="h-5 w-5" />
        {{ t("dashboard.token.previeJSON.title") }}
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-3">
      <Textarea
        :model-value="props.modelValue"
        :rows="24"
        class="min-h-[420px] font-mono text-xs leading-5"
        :aria-invalid="hasError"
        @update:model-value="
          (value) => emits('update:modelValue', String(value ?? ''))
        "
      />

      <div
        v-if="hasError"
        class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {{ props.errorMessage }}
      </div>
    </CardContent>
  </Card>
</template>
