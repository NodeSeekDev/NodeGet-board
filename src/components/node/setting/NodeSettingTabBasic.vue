<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import NodeMetadataForm from "@/components/node/NodeMetadataForm.vue";
import type { NodeMetadata } from "@/types/agent";
import { useKv } from "@/composables/useKv";
import { useNodeMetadata } from "@/composables/useNodeMetadata";
import { useI18n } from "vue-i18n";

const props = defineProps<{ uuid: string }>();

const { t } = useI18n();
const kv = useKv();
const { parseMetadataFields, buildMetadataBatch, initDefaultMetadata } =
  useNodeMetadata(kv);

const loading = ref(false);
const saveLoading = ref(false);

const form = ref<NodeMetadata>({
  customName: "",
  tags: [],
  price: 0,
  priceUnit: "$",
  priceCycle: 30,
  expireTime: "",
  region: "",
  hidden: false,
  order: 0,
});

onMounted(async () => {
  loading.value = true;
  try {
    await kv.fetchNamespaces();
    const existedNS = kv.namespaces.value.includes(props.uuid);
    if (!existedNS) {
      await kv.createNamespace(props.uuid);
    }

    kv.namespace.value = props.uuid;
    let results = await kv.getMultiValue([
      { namespace: props.uuid, key: "metadata_*" },
    ]);

    if (results.length === 0) {
      await initDefaultMetadata(props.uuid);
      results = await kv.getMultiValue([
        { namespace: props.uuid, key: "metadata_*" },
      ]);
    }

    form.value = parseMetadataFields(results, props.uuid.slice(-6));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  saveLoading.value = true;
  try {
    kv.namespace.value = props.uuid;
    const { partialFailures } = await kv.setValueBatch(
      buildMetadataBatch(form.value),
    );
    if (partialFailures.length > 0) {
      toast.warning(`Partial save failure: ${partialFailures.join(", ")}`);
    } else {
      toast.success(t("dashboard.saveSuccess"));
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : t("dashboard.saveFailed"));
  } finally {
    saveLoading.value = false;
  }
}
</script>

<template>
  <div class="max-w-lg space-y-6">
    <div
      v-if="loading"
      class="flex items-center gap-2 text-muted-foreground text-sm py-4"
    >
      <Loader2 class="h-4 w-4 animate-spin" />
      {{ $t("common.loading") }}
    </div>

    <template v-else>
      <NodeMetadataForm v-model="form" />
      <div class="pt-2">
        <Button :disabled="saveLoading" @click="handleSave">
          <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
          {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
        </Button>
      </div>
    </template>
  </div>
</template>
