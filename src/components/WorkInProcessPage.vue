<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">
      {{ route.meta.title ? $t(route.meta.title as string) : "" }}
    </h1>

    <p class="text-muted-foreground text-sm">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const route = useRoute();

function getDescription() {
  return t("dashboard.workInProcess");
}

const description = computed(() => {
  return getDescription();
});
</script>
