<script setup lang="ts">
import { ref } from "vue";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "./components/Sidebar.vue";
import DashboardHeader from "./components/DashboardHeader.vue";
import AppMain from "./components/AppMain.vue";

const collapsed = ref(false);
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <TooltipProvider>
      <Sidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
      <div class="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <AppMain />
      </div>
    </TooltipProvider>
  </div>
</template>
