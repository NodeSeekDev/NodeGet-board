<script setup lang="ts">
import { computed } from "vue";
import { Check, Sparkles, UserRound, Wrench } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TOKEN_PERMISSION_TEMPLATE_OPTIONS,
  type TokenPermissionTemplateValue,
} from "../tokenPermissionTemplates";

const props = defineProps<{
  modelValue: TokenPermissionTemplateValue;
}>();

const emits = defineEmits<{
  (e: "update:modelValue", value: TokenPermissionTemplateValue): void;
}>();

const iconMap = {
  agent: Sparkles,
  visitor: UserRound,
  custom: Wrench,
} satisfies Record<TokenPermissionTemplateValue, typeof Sparkles>;

const currentValue = computed({
  get: () => props.modelValue,
  set: (value: TokenPermissionTemplateValue) =>
    emits("update:modelValue", value),
});

const isSelected = (value: TokenPermissionTemplateValue) =>
  currentValue.value === value;
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">权限模版</CardTitle>
    </CardHeader>

    <CardContent class="grid gap-3 md:grid-cols-3">
      <button
        v-for="option in TOKEN_PERMISSION_TEMPLATE_OPTIONS"
        :key="option.value"
        type="button"
        class="group rounded-xl border p-4 text-left transition-colors"
        :class="
          isSelected(option.value)
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
        "
        @click="currentValue = option.value"
      >
        <div class="flex items-start justify-between gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-lg border transition-colors"
            :class="
              isSelected(option.value)
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            "
          >
            <component :is="iconMap[option.value]" class="size-4" />
          </div>

          <div
            class="flex size-5 items-center justify-center rounded-full border transition-colors"
            :class="
              isSelected(option.value)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/30 text-transparent'
            "
          >
            <Check class="size-3" />
          </div>
        </div>

        <div class="mt-4 space-y-1">
          <div class="text-sm font-medium text-foreground">
            {{ option.label }}
          </div>
          <div class="text-xs leading-5 text-muted-foreground">
            {{ option.description }}
          </div>
        </div>
      </button>
    </CardContent>
  </Card>
</template>
