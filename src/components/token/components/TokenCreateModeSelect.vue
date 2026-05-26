<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import TokenTemplateList from "./TokenTemplateList.vue";
import type { TokenTemplate } from "../tokenTemplates.ts";

const emits = defineEmits<{
  (e: "select-custom"): void;
  (e: "select-template", template: TokenTemplate): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>
          {{ t("dashboard.token.create.mode.title") }}
        </CardTitle>
        <CardDescription>
          {{ t("dashboard.token.create.mode.description") }}
        </CardDescription>
      </CardHeader>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>
          {{ t("dashboard.token.create.custom.title") }}
        </CardTitle>
        <CardDescription>
          {{ t("dashboard.token.create.custom.description") }}
        </CardDescription>
      </CardHeader>
      <CardContent
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="text-sm text-muted-foreground">
          {{ t("dashboard.token.create.custom.hint") }}
        </div>
        <Button type="button" @click="emits('select-custom')">
          {{ t("dashboard.token.create.custom.action") }}
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>
          {{ t("dashboard.token.create.templates.title") }}
        </CardTitle>
        <CardDescription>
          {{ t("dashboard.token.create.templates.description") }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TokenTemplateList
          @select="(template) => emits('select-template', template)"
        />
      </CardContent>
    </Card>
  </div>
</template>
