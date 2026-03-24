<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import CreateTokenCard from "@/components/token/create-token/CreateTokenCard.vue";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";

const router = useRouter();

const handleBack = () => {
  router.push({ name: "token" });
};
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-start gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="mt-0.5 size-9 shrink-0"
        @click="handleBack"
      >
        <ArrowLeft class="h-4 w-4" />
        <span class="sr-only">返回Token列表</span>
      </Button>
      <div>
        <h2 class="text-2xl font-bold tracking-tight">创建 Token</h2>
        <p class="text-muted-foreground">新建一个Token</p>
      </div>
    </div>
    <!-- grid gap-6 xl:grid-cols-2 -->
    <div class="">
      <CreateTokenCard />
      <!-- <DeleteTokenCard /> -->
    </div>
  </div>
</template>
