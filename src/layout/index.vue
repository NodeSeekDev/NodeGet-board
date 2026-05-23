<script setup lang="ts">
import { ref } from "vue";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "./components/Sidebar.vue";
import DashboardHeader from "./components/DashboardHeader.vue";
import AppMain from "./components/AppMain.vue";

const collapsed = ref(false);
const isMobileSidebarOpen = ref(false);
</script>

<template>
  <div class="bg-background relative flex h-screen overflow-hidden">
    <TooltipProvider>
      <div
        v-if="isMobileSidebarOpen"
        class="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
        @click="isMobileSidebarOpen = false"
      ></div>

      <Sidebar
        :collapsed="collapsed"
        :is-mobile-sidebar-open="isMobileSidebarOpen"
        @toggle="collapsed = !collapsed"
        @close-mobile="isMobileSidebarOpen = false"
      />
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader @open-mobile-sidebar="isMobileSidebarOpen = true" />
        <AppMain />
      </div>
    </TooltipProvider>
  </div>
</template>
