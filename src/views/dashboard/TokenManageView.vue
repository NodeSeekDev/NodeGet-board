<script setup lang="ts">
import { useBackendStore } from "@/composables/useBackendStore";
import CreateTokenCard from "@/components/token-manage/CreateTokenCard.vue";
import DeleteTokenCard from "@/components/token-manage/DeleteTokenCard.vue";
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Tokens</h2>
        <p class="text-muted-foreground">Manage your API tokens securely.</p>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <CreateTokenCard />
      <DeleteTokenCard />
    </div>
  </div>
</template>
