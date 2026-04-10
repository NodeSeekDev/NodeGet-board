<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import ExtensionDetail from "@/components/extensions/ExtensionDetail.vue";
import { useExtensions } from "@/composables/useExtensions";
import type { Extension } from "@/composables/useExtensions";

definePage({ meta: { title: "", hidden: true } });

const route = useRoute();
const router = useRouter();
const extensionId = computed(() => (route.params as Record<string, string>).id);

const { extensions, loading, fetchExtensions } = useExtensions();

const extension = computed(
  () => extensions.value.find((e) => e.id === extensionId.value) ?? null,
);

const fetched = ref(extensions.value.length > 0);

onMounted(() => {
  if (extensions.value.length === 0) {
    fetchExtensions().finally(() => {
      fetched.value = true;
    });
  }
});

const handleDeleted = () => {
  router.push("/dashboard/app-panel");
};

const handleUpdated = (ext: Extension) => {
  const idx = extensions.value.findIndex((e) => e.id === ext.id);
  if (idx >= 0) extensions.value[idx] = ext;
};
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        @click="router.push('/dashboard/app-panel')"
      >
        <ArrowLeft class="h-4 w-4 mr-1" />
        返回
      </Button>
      <h2 class="text-xl font-semibold">{{ extension?.app.name }}</h2>
    </div>

    <div
      v-if="!fetched || loading"
      class="flex flex-1 items-center justify-center"
    >
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
    </div>

    <div
      v-else-if="!extension"
      class="flex flex-1 items-center justify-center text-muted-foreground"
    >
      未找到扩展
    </div>

    <ExtensionDetail
      v-else
      :extension="extension"
      @deleted="handleDeleted"
      @updated="handleUpdated"
    />
  </div>
</template>
