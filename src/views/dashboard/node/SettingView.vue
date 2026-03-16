<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import NodeMetadataForm from "@/components/node/NodeMetadataForm.vue";
import type { NodeMetadata } from "@/types/node";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { t } = useI18n();
const _uuid = route.params.uuid as string;

const form = ref<NodeMetadata>({
  name: "Hong Kong Node 01",
  tags: ["BGP", "CMI", "premium"],
  price: 29.9,
  priceUnit: "¥",
  priceCycle: 30,
  region: "HK",
  hidden: false,
});

function handleSave() {
  toast.success(t("dashboard.saveSuccess"));
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-auto rounded-md border bg-card p-6">
      <div class="max-w-lg space-y-6">
        <div>
          <h2 class="text-lg font-semibold">
            {{ $t("dashboard.node.settingsTitle") }}
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            {{ $t("dashboard.node.settingsDesc") }}
          </p>
        </div>

        <NodeMetadataForm v-model="form" />

        <div class="pt-2">
          <Button @click="handleSave">{{ $t("dashboard.save") }}</Button>
        </div>
      </div>
    </div>
  </div>
</template>
