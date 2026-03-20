<script setup lang="ts">
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateTokenForm } from "./useCreateTokenForm";
import TemplatePresetBar from "../create-token/sections/TemplatePresetBar.vue";
import GeneralLimitSection from "../create-token/sections/GeneralLimitSection.vue";
import KvLimitSection from "../create-token/sections/KvLimitSection.vue";
import TokenMetaSection from "../create-token/sections/TokenMetaSection.vue";
import TokenCreateActions from "../create-token/sections/TokenCreateActions.vue";

const form = useCreateTokenForm();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <KeyRound class="h-5 w-5" />
        Create Token
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2">
      <div>
        <TemplatePresetBar :form="form" />
        <GeneralLimitSection :form="form" />
        <KvLimitSection :form="form" />
        <TokenMetaSection :form="form" />
        <TokenCreateActions :form="form" />
      </div>
      <!-- 预览区 -->
      <div></div>
    </CardContent>
  </Card>
</template>
