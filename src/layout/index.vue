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
  <div class="flex h-screen overflow-hidden bg-background relative">
    <TooltipProvider>
      <!-- Mobile Sidebar Overlay -->
      <div
        v-if="isMobileSidebarOpen"
        class="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
        @click="isMobileSidebarOpen = false"
      ></div>

      <Sidebar
        :collapsed="collapsed"
        :is-mobile-sidebar-open="isMobileSidebarOpen"
        @toggle="collapsed = !collapsed"
        @close-mobile="isMobileSidebarOpen = false"
      />
      <div class="flex flex-1 flex-col overflow-hidden min-w-0">
        <DashboardHeader @open-mobile-sidebar="isMobileSidebarOpen = true" />
        <AppMain />
      </div>
    </TooltipProvider>
  </div>
</template>
