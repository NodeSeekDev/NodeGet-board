<script setup lang="ts">
import type { Token } from "../type";
import { Button } from "@/components/ui/button";
import BaseInfoFrom from "./baseInfoFrom.vue";
import TokenLimitFrom from "./tokenLimitFrom.vue";
import PreviewTokenJson from "./previewTokenJson.vue";

const props = withDefaults(
  defineProps<{
    token: Token;
    submitLabel: string;
    submittingLabel: string;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    loading: false,
    disabled: false,
  },
);

const emits = defineEmits<{
  (e: "update:token", token: Token): void;
  (e: "submit"): void;
}>();
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-2">
    <div class="space-y-4">
      <BaseInfoFrom
        :token="props.token"
        @update:token="(value) => emits('update:token', value)"
      />
      <TokenLimitFrom
        :token="props.token"
        @update:token="(value) => emits('update:token', value)"
      />
      <Button
        class="w-full"
        :disabled="props.disabled || props.loading"
        @click="emits('submit')"
      >
        <div v-if="props.loading">
          {{ props.submittingLabel }}
        </div>
        <div v-else>
          {{ props.submitLabel }}
        </div>
      </Button>
    </div>

    <div>
      <PreviewTokenJson :token="props.token" />
    </div>
  </div>
</template>
