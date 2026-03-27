<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { KeyRound, Upload } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TokenEditorWorkspace from "../components/TokenEditorWorkspace.vue";
import TokenSuccessDialog from "../components/TokenSuccessDialog.vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCreatTokenHook } from "../create-token/useCreateToken";
import { createDefaultToken } from "../scopeCodec";
import type { Token } from "../type";
import { parseImportedTokenJson } from "./importToken";

const createToken = useCreatTokenHook();
const { t } = useI18n();

const importSource = ref("");
const parsedToken = ref<Token>(createDefaultToken());
const hasParsedResult = ref(false);
const parseConfirmOpen = ref(false);
const parseLoading = ref(false);
const importLoading = ref(false);
const successDialogOpen = ref(false);
const createdTokenInfo = ref({
  key: "",
  secret: "",
});

const canParse = computed(() => importSource.value.trim().length > 0);

const handleOpenParseConfirm = () => {
  if (!canParse.value) {
    toast.error(t("dashboard.token.import.emptyInput"));
    return;
  }

  parseConfirmOpen.value = true;
};

const handleParseImportedToken = async () => {
  parseLoading.value = true;
  try {
    parsedToken.value = parseImportedTokenJson(importSource.value);
    hasParsedResult.value = true;
    parseConfirmOpen.value = false;
    toast.success(t("dashboard.token.import.parseSuccess"));
  } catch {
    hasParsedResult.value = false;
    toast.error(t("dashboard.token.import.parseFailed"));
  } finally {
    parseLoading.value = false;
  }
};

const handleImportToken = async () => {
  importLoading.value = true;
  try {
    const result = await createToken.createToken(parsedToken.value);
    if (result.key && result.secret) {
      createdTokenInfo.value = {
        key: result.key,
        secret: result.secret,
      };
      successDialogOpen.value = true;
    }
  } finally {
    importLoading.value = false;
  }
};

const handleParsedTokenChange = (value: Token) => {
  parsedToken.value = value;
};
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Upload class="h-5 w-5" />
          {{ t("dashboard.token.import.parseCard.title") }}
        </CardTitle>
      </CardHeader>

      <CardContent class="space-y-4">
        <div class="space-y-2">
          <div class="text-sm text-muted-foreground">
            {{ t("dashboard.token.import.parseCard.description") }}
          </div>
          <textarea
            v-model="importSource"
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[220px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            :placeholder="t('dashboard.token.import.parseCard.placeholder')"
          />
        </div>

        <Button
          type="button"
          class="w-full sm:w-auto"
          :disabled="parseLoading"
          @click="handleOpenParseConfirm"
        >
          <div v-if="parseLoading">
            {{ t("dashboard.token.import.parseCard.parsingButton") }}
          </div>
          <div v-else>
            {{ t("dashboard.token.import.parseCard.parseButton") }}
          </div>
        </Button>
      </CardContent>
    </Card>

    <Card v-if="hasParsedResult">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <KeyRound class="h-5 w-5" />
          {{ t("dashboard.token.import.importCard.title") }}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <TokenEditorWorkspace
          :token="parsedToken"
          :loading="importLoading"
          :submit-label="t('dashboard.token.import.importCard.importButton')"
          :submitting-label="
            t('dashboard.token.import.importCard.importingButton')
          "
          @update:token="handleParsedTokenChange"
          @submit="handleImportToken"
        />
      </CardContent>
    </Card>
  </div>

  <AlertDialog v-model:open="parseConfirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ t("dashboard.token.import.parseConfirm.title") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ t("dashboard.token.import.parseConfirm.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>
          {{ t("dashboard.token.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction
          :disabled="parseLoading"
          @click="handleParseImportedToken"
        >
          <div v-if="parseLoading">
            {{ t("dashboard.token.import.parseConfirm.confirmingButton") }}
          </div>
          <div v-else>
            {{ t("dashboard.token.import.parseConfirm.confirmButton") }}
          </div>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <TokenSuccessDialog
    v-model:open="successDialogOpen"
    :token-key="createdTokenInfo.key"
    :token-secret="createdTokenInfo.secret"
  />
</template>
