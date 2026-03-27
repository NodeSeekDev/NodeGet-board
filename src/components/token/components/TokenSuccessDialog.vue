<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  tokenKey: string;
  tokenSecret: string;
}>();

const { t } = useI18n();

const copyText = async (value: string, successMessage: string) => {
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error(t("dashboard.token.create.createSuccessDialog.copyFailed"));
  }
};
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {{ t("dashboard.token.create.createSuccessDialog.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ t("dashboard.token.create.createSuccessDialog.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label>{{
            t("dashboard.token.create.createSuccessDialog.tokenKeyLabel")
          }}</Label>
          <div class="flex items-center gap-2">
            <Input :model-value="props.tokenKey" readonly />
            <Button
              type="button"
              variant="outline"
              size="icon"
              @click="
                copyText(
                  props.tokenKey,
                  t(
                    'dashboard.token.create.createSuccessDialog.copyTokenKeySuccess',
                  ),
                )
              "
            >
              <Copy class="h-4 w-4" />
              <span class="sr-only">
                {{
                  t("dashboard.token.create.createSuccessDialog.copyTokenKey")
                }}
              </span>
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label>{{
            t("dashboard.token.create.createSuccessDialog.tokenSecretLabel")
          }}</Label>
          <div class="flex items-center gap-2">
            <Input :model-value="props.tokenSecret" readonly />
            <Button
              type="button"
              variant="outline"
              size="icon"
              @click="
                copyText(
                  props.tokenSecret,
                  t(
                    'dashboard.token.create.createSuccessDialog.copyToeknSecretSuccess',
                  ),
                )
              "
            >
              <Copy class="h-4 w-4" />
              <span class="sr-only">
                {{
                  t(
                    "dashboard.token.create.createSuccessDialog.copyTokenSecret",
                  )
                }}
              </span>
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          class="w-full"
          @click="
            copyText(
              `${props.tokenKey}:${props.tokenSecret}`,
              t(
                'dashboard.token.create.createSuccessDialog.copyFullTokenSuccess',
              ),
            )
          "
        >
          {{ t("dashboard.token.create.createSuccessDialog.copyFullToken") }}
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" @click="open = false">
          {{ t("dashboard.token.create.createSuccessDialog.saved") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
