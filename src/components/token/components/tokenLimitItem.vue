<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { type TokenLimitEntry } from "../type";
import { detectScopeTab, type ScopeTabValue } from "../scopeUi";
import { ChevronDown, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PopConfirm } from "@/components/ui/pop-confirm";
import limitScopeConfig from "./limitScopeConfig.vue";
import tokenPermissionTemplateCard from "./tokenPermissionTemplateCard.vue";
import permissionsCard from "./permissions/permissionsCard.vue";
import {
  applyTokenPermissionTemplate,
  detectTokenPermissionTemplate,
  type TokenPermissionTemplateValue,
} from "../tokenPermissionTemplates";

const props = defineProps<{
  tokenLimit: TokenLimitEntry;
  index: number;
  limitLength: number;
  defaultOpen?: boolean;
}>();
const emits = defineEmits<{
  (e: "update:tokenLimit", tokenLimit: TokenLimitEntry): void;
  (e: "deleteLimit", index: number): void;
}>();
const { t } = useI18n();

const localTokenLimit = ref<TokenLimitEntry>(props.tokenLimit);
const scopeTab = ref<ScopeTabValue>(detectScopeTab(props.tokenLimit.scopes));
const selectedTemplate = ref<TokenPermissionTemplateValue>("custom");
const isOpen = ref(false);

const syncSelectedTemplate = () => {
  selectedTemplate.value = detectTokenPermissionTemplate(
    localTokenLimit.value,
    scopeTab.value,
  );
};

watch(
  () => props.tokenLimit,
  (value) => {
    localTokenLimit.value = value;
    scopeTab.value = detectScopeTab(value.scopes, scopeTab.value);
    syncSelectedTemplate();
  },
  { immediate: true, deep: true },
);

watch(
  () => props.defaultOpen,
  (value) => {
    if (value) {
      isOpen.value = true;
    }
  },
  { immediate: true },
);

watch(
  localTokenLimit,
  (value) => {
    emits("update:tokenLimit", value);
    syncSelectedTemplate();
  },
  { deep: true },
);

watch(scopeTab, () => {
  syncSelectedTemplate();
});

const handleDeleteLimit = () => {
  emits("deleteLimit", props.index);
};

const handleTemplateChange = (value: TokenPermissionTemplateValue) => {
  selectedTemplate.value = value;

  if (value === "custom") {
    return;
  }

  const next = applyTokenPermissionTemplate(value, localTokenLimit.value);
  scopeTab.value = next.scopeTab;
  localTokenLimit.value = next.tokenLimit;
};
</script>

<template>
  <Collapsible v-model:open="isOpen" class="space-y-2">
    <div class="flex w-full items-center justify-between gap-2">
      <div>
        {{ t("dashboard.token.permissionsConfig.limitItem.title") }}
        {{ props.index + 1 }}
      </div>
      <div class="flex-1"></div>
      <PopConfirm
        v-if="props.limitLength > 1"
        :title="t('dashboard.token.permissionsConfig.limitItem.deleteTitle')"
        :description="
          t('dashboard.token.permissionsConfig.limitItem.deleteDescription')
        "
        :confirm-text="
          t('dashboard.token.permissionsConfig.limitItem.deleteConfirm')
        "
        :cancel-text="
          t('dashboard.token.permissionsConfig.limitItem.deleteCancel')
        "
        @confirm="handleDeleteLimit"
      >
        <Button variant="ghost" size="icon" class="size-8 text-red-500">
          <Trash2 />
          <span class="sr-only">{{
            t("dashboard.token.permissionsConfig.deleteAriaLabel")
          }}</span>
        </Button>
      </PopConfirm>
      <CollapsibleTrigger as-child>
        <Button variant="ghost" size="icon" class="size-8">
          <ChevronDown
            class="h-4 w-4 transition-transform duration-200"
            :class="{ 'rotate-180': isOpen }"
          />
          <span class="sr-only">{{
            t("dashboard.token.permissionsConfig.toggleAriaLabel")
          }}</span>
        </Button>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent class="space-y-2">
      <tokenPermissionTemplateCard
        :model-value="selectedTemplate"
        @update:model-value="handleTemplateChange"
      />
      <limitScopeConfig
        v-if="localTokenLimit"
        v-model:scope="localTokenLimit.scopes"
        v-model:scopeTab="scopeTab"
      />
      <permissionsCard
        v-model:permissions="localTokenLimit.permissions"
        :scope="localTokenLimit.scopes"
        :scope-tab="scopeTab"
      />
    </CollapsibleContent>
  </Collapsible>
</template>
