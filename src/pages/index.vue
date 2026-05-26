<script setup lang="ts">
// deprecated

import HeaderView from "@/components/HeaderView.vue";
import FooterView from "@/components/FooterView.vue";
import Loader from "@/components/misc/loader.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <div class="container mx-auto flex flex-1 flex-col space-y-6 p-6">
      <HeaderView status="connecting" />

      <TransitionGroup tag="div" name="list" class="flex flex-1">
        <div class="flex w-full flex-col items-center justify-center gap-4">
          <Loader></Loader>
        </div>
      </TransitionGroup>
      <FooterView />
    </div>
  </div>
</template>
