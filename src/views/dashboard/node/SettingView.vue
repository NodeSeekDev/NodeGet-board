<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import NodeMetadataForm from "@/components/node/NodeMetadataForm.vue";
import type { NodeMetadata } from "@/types/node";
import { useKv } from "@/composables/useKv";
import { useNodeMetadata } from "@/composables/useNodeMetadata";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { t } = useI18n();
const uuid = route.params.uuid as string;

const kv = useKv();
const { parseMetadataFields, buildMetadataBatch, initDefaultMetadata } =
  useNodeMetadata(kv);
const loading = ref(false);
const saveLoading = ref(false);

const form = ref<NodeMetadata>({
  name: "",
  tags: [],
  price: 0,
  priceUnit: "$",
  priceCycle: 30,
  region: "",
  hidden: false,
});

onMounted(async () => {
  loading.value = true;
  try {
    kv.namespace.value = uuid;
    let results = await kv.getMultiValue([
      { namespace: uuid, key: "metadata_*" },
    ]);

    // 若 namespace 不存在则先创建再初始化默认值
    if (results.length === 0) {
      try {
        await kv.createNamespace(uuid);
      } catch {
        // namespace 可能已存在，忽略
      }
      await initDefaultMetadata(uuid);
      results = await kv.getMultiValue([
        { namespace: uuid, key: "metadata_*" },
      ]);
    }

    form.value = parseMetadataFields(results, uuid.slice(-6));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "加载节点配置失败");
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  saveLoading.value = true;
  try {
    kv.namespace.value = uuid;
    const f = form.value;
    const { partialFailures } = await kv.setValueBatch(buildMetadataBatch(f));
    if (partialFailures.length > 0) {
      toast.warning(`部分字段保存失败：${partialFailures.join("、")}`);
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

        <div
          v-if="loading"
          class="flex items-center gap-2 text-muted-foreground text-sm py-8"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>

        <template v-else>
          <NodeMetadataForm v-model="form" />

          <div class="pt-2">
            <Button :disabled="saveLoading" @click="handleSave">
              <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
              {{ saveLoading ? "保存中..." : $t("dashboard.save") }}
            </Button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
