<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ArrowLeft, Menu } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const emit = defineEmits<{
  openMobileSidebar: [];
}>();
</script>

<template>
  <header class="flex h-14 shrink-0 items-center border-b px-4 gap-3">
    <Button
      variant="ghost"
      size="icon"
      class="md:hidden shrink-0"
      @click="emit('openMobileSidebar')"
    >
      <Menu class="h-5 w-5" />
    </Button>
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
