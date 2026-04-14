<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ScanEye } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HeaderFilter from "./components/headerFilter.vue";
import LogsList from "./components/logsList.vue";
</script>

<template>
  <div class="flex flex-col">
    <HeaderFilter />
    <LogsList />
  </div>
</template>
