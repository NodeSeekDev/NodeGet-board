<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { ArrowLeft, Copy, KeyRound, Pencil } from "lucide-vue-next";
import type { Token, TokenDetail } from "../type";
import { mapTokenDetailToForm } from "@/composables/token/useEditToken";
import { useTokenListHook } from "@/composables/token/useTokenList";
import TokenDetailPreview from "../components/tokenDetailPreview.vue";
import { Button } from "@/components/ui/button";

const useTokenList = useTokenListHook();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const detailLoading = ref(false);
const rawDetail = ref<TokenDetail | null>(null);
const normalizedToken = ref<Token>(mapTokenDetailToForm(null));

const getTargetToken = () => {
  const queryToken = route.query.token;
  return typeof queryToken === "string" ? queryToken.trim() : "";
};

const displayText = (
  value: string | number | null | undefined,
  fallback = "-",
) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return String(value);
};

const formattedJson = computed(() =>
  JSON.stringify(rawDetail.value ?? {}, null, 2),
);

const handleGetTokenDetail = async () => {
  const targetToken = getTargetToken();
  if (!targetToken) return;

  detailLoading.value = true;
  try {
    const detail = await useTokenList.getTokenDetailApi(targetToken);
    rawDetail.value = detail;
    normalizedToken.value = mapTokenDetailToForm(detail);
  } finally {
    detailLoading.value = false;
  }
};

const copyText = async (value: string, successMessage: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error(t("dashboard.token.detail.copyFailed"));
  }
};

const handleBack = () => {
  router.push("/dashboard/token");
};

const handleEdit = () => {
  const targetToken = getTargetToken();
  if (!targetToken) return;
  router.push({ path: "/dashboard/tokenEdit", query: { token: targetToken } });
};

onMounted(() => {
  handleGetTokenDetail();
});
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="space-y-1">
        <div class="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="mt-0.5 size-9 shrink-0"
            :disabled="detailLoading"
            @click="handleBack"
          >
            <ArrowLeft class="h-4 w-4" />
            <span class="sr-only">{{
              t("dashboard.token.detail.returnButtonDescription")
            }}</span>
          </Button>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <KeyRound class="h-5 w-5" />
              <h2 class="text-2xl font-bold tracking-tight">
                {{ t("dashboard.token.detail.title") }}
              </h2>
            </div>
            <p class="text-muted-foreground">
              {{ t("dashboard.token.detail.description") }}
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="detailLoading" @click="handleEdit">
          <Pencil class="h-4 w-4" />
          {{ t("dashboard.token.detail.editButton") }}
        </Button>
        <Button
          variant="outline"
          :disabled="detailLoading"
          @click="
            copyText(
              displayText(rawDetail?.token_key, ''),
              t('dashboard.token.detail.copyTokenKeySuccess'),
            )
          "
        >
          <Copy class="h-4 w-4" />
          {{ t("dashboard.token.detail.copyTokenKey") }}
        </Button>
        <Button
          :disabled="detailLoading"
          @click="
            copyText(
              formattedJson,
              t('dashboard.token.detail.copyFullJsonSuccess'),
            )
          "
        >
          <Copy class="h-4 w-4" />
          {{ t("dashboard.token.detail.copyFullJson") }}
        </Button>
      </div>
    </div>

    <TokenDetailPreview
      :token="normalizedToken"
      :raw-detail="rawDetail"
      :loading="detailLoading"
    />
  </div>
</template>
