<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Token } from "../type";
import { Button } from "@/components/ui/button";
import BaseInfoFrom from "./baseInfoFrom.vue";
import TokenLimitFrom from "./tokenLimitFrom.vue";
import PreviewTokenJson from "./previewTokenJson.vue";
import { serializeTokenPayload } from "../scopeCodec";
import { applyPartialTokenPayload } from "../tokenPayload";

const props = withDefaults(
  defineProps<{
    token: Token;
    submitLabel: string;
    submittingLabel: string;
    loading?: boolean;
    disabled?: boolean;
    showBackButton?: boolean;
    backLabel?: string;
  }>(),
  {
    loading: false,
    disabled: false,
    showBackButton: false,
    backLabel: "",
  },
);

const emits = defineEmits<{
  (e: "update:token", token: Token): void;
  (e: "submit"): void;
  (e: "back"): void;
}>();

const { t } = useI18n();

const jsonText = ref("");
const jsonErrorMessage = ref("");
const skipNextTokenSync = ref(false);

const serializedToken = computed(() =>
  JSON.stringify(serializeTokenPayload(props.token), null, 2),
);

const submitDisabled = computed(
  () =>
    props.disabled || props.loading || jsonErrorMessage.value.trim().length > 0,
);

watch(
  serializedToken,
  (value) => {
    if (skipNextTokenSync.value) {
      skipNextTokenSync.value = false;
      return;
    }

    jsonText.value = value;
    jsonErrorMessage.value = "";
  },
  { immediate: true },
);

const formatJsonIssue = (issue: string) =>
  t("dashboard.token.previeJSON.invalidField", { field: issue });

const handleJsonChange = (value: string) => {
  jsonText.value = value;

  try {
    const parsed = JSON.parse(value) as unknown;
    const result = applyPartialTokenPayload(props.token, parsed);
    jsonErrorMessage.value =
      result.dataIssues.length > 0
        ? result.dataIssues.map(formatJsonIssue).join(" ")
        : "";

    skipNextTokenSync.value = true;
    emits("update:token", result.token);
  } catch (error) {
    jsonErrorMessage.value = t("dashboard.token.previeJSON.invalidJson", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-2">
    <div class="space-y-4">
      <Button
        v-if="props.showBackButton"
        type="button"
        variant="outline"
        class="w-full sm:w-auto"
        @click="emits('back')"
      >
        {{ props.backLabel }}
      </Button>
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
        :disabled="submitDisabled"
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
      <PreviewTokenJson
        :model-value="jsonText"
        :error-message="jsonErrorMessage"
        @update:model-value="handleJsonChange"
      />
    </div>
  </div>
</template>
