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
import permissionsCard from "./permissions/permissionsCard.vue";

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
const isOpen = ref(false);

watch(
  () => props.tokenLimit,
  (value) => {
    localTokenLimit.value = value;
    scopeTab.value = detectScopeTab(value.scopes, scopeTab.value);
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
  },
  { deep: true },
);

const handleDeleteLimit = () => {
  emits("deleteLimit", props.index);
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
