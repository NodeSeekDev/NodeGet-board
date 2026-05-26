<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import ThemeDetail from "@/components/theme-management/ThemeDetail.vue";
import { useStaticBucket } from "@/composables/useStaticBucket";

definePage({ meta: { title: "", hidden: true } });

const route = useRoute("/dashboard/theme/[name]");
const router = useRouter();
const staticBucket = useStaticBucket();

const bucketName = computed(() => (route.params as { name: string }).name);

const themeName = computed(
  () =>
    staticBucket.buckets.value
      .find((b) => b.name === bucketName.value)
      ?.name.replace(/^theme_/, "") ?? bucketName.value.replace(/^theme_/, ""),
);

onMounted(() => {
  if (!staticBucket.buckets.value.length) staticBucket.fetchList();
});
</script>

<template>
  <div class="h-full flex flex-col gap-4 p-6 overflow-hidden">
    <div class="flex items-center gap-3 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        @click="router.push('/dashboard/theme-management')"
      >
        <ArrowLeft class="h-4 w-4 mr-1" />
        返回
      </Button>
      <h2 class="text-xl font-semibold">{{ themeName }}</h2>
    </div>
    <ThemeDetail :bucket-name="bucketName" class="flex-1 overflow-y-auto" />
  </div>
</template>
