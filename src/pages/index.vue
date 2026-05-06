<script setup lang="ts">
// deprecated

import HeaderView from "@/components/HeaderView.vue";
import FooterView from "@/components/FooterView.vue";
import Loader from "@/components/misc/loader.vue";
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <div class="container mx-auto p-6 space-y-6 flex-1 flex flex-col">
      <HeaderView status="connecting" />

      <TransitionGroup tag="div" name="list" class="flex flex-1">
        <div class="flex-col gap-4 w-full flex items-center justify-center">
          <Loader></Loader>
        </div>
      </TransitionGroup>
      <FooterView />
    </div>
  </div>
</template>
