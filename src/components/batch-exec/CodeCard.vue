<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Code } from "lucide-vue-next";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import CodeCard from "@/components/batch-exec/widgets/Code.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const codeTips = ref(false);

const props = defineProps<{ modelValue: string }>();
const emits = defineEmits<{
  (e: "update:modelValue", val: string): void;
  (e: "openScriptsSelect"): void;
}>();

watch(
  () => props.modelValue,
  (val) => {
    codeProxy.value = val;
  },
);

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
        <label class="flex items-center">
          <span class="text-sm color-gray-500 mr-1 opacity-60">{{
            $t("dashboard.batchExec.codeTips")
          }}</span>
          <Switch
            v-model="codeTips"
            :title="$t('dashboard.batchExec.codeTips')"
          />
        </label>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <CodeCard v-model="codeProxy" :codeTips="codeTips" />
      <div class="flex gap-2 mt-1 items-center justify-end">
        <Button
          @click="emits('openScriptsSelect')"
          variant="outline"
          class="w-full md:w-auto"
          >{{ $t("dashboard.batchExec.scriptsSelect") }}</Button
        >
      </div>
    </CardContent>
  </Card>
</template>
