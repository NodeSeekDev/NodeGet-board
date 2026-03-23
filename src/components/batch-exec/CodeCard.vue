<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Code } from "lucide-vue-next";
import { Switch } from "@/components/ui/switch";
import CodeCard from "@/components/batch-exec/widgets/Code.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const codeTips = ref(false);

const props = defineProps<{ modelValue: string }>();
const emits = defineEmits<{
  (e: "update:modelValue", val: string): void;
}>();

const codeProxy = computed({
  get: () => props.modelValue ?? "",
  set: (val: string) => emits("update:modelValue", val),
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <Code class="h-5 w-5" />{{ $t("dashboard.batchExec.codeInputLabel") }}
        </div>
        <Switch
          v-model="codeTips"
          :label="$t('dashboard.batchExec.codeTips')"
        />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <CodeCard v-model="codeProxy" :codeTips="codeTips" />
    </CardContent>
  </Card>
</template>
