<script setup lang="ts">
import { ref } from "vue";
import { type token } from "../type";
import { KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const props = defineProps<{
  token: token | {};
}>();
</script>

<template>
  <Card border="none">
    <CardHeader>
      <CardTitle class="flex items-center gap-2"> 静态监控权限 </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6 grid gap-6 xl:grid-cols-2"> </CardContent>
  </Card>
  <div></div>
</template>
