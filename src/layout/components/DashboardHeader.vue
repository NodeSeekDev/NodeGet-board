<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ArrowLeft } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
</script>

<template>
  <header class="flex h-14 shrink-0 items-center border-b px-4 gap-3">
    <div class="ml-auto">
      <RouterLink to="/">
        <Button variant="ghost" size="sm">
          <ArrowLeft class="h-4 w-4 mr-1" />
          返回监控
        </Button>
      </RouterLink>
    </div>
  </header>
</template>
