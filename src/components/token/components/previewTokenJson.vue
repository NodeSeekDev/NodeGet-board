<script setup lang="ts">
import { ref } from "vue";
import { type token } from "../type";
import { ScanEye } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const props = defineProps<{
  token: token | {};
}>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <ScanEye class="h-5 w-5" />
        格式化预览Token
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2">
      <!-- <div class="text-sm font-medium">token_limit preview</div> -->
      <pre class="text-xs leading-5 overflow-x-auto">{{
        JSON.stringify(props.token, null, 2)
      }}</pre>
    </CardContent>
  </Card>
</template>
