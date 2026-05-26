<script setup lang="ts">
import { ChevronUp, ChevronDown } from "lucide-vue-next";
import {
  NumberFieldRoot,
  NumberFieldInput,
  NumberFieldIncrement,
  NumberFieldDecrement,
} from "reka-ui";
import type { NumberFieldRootProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<
  NumberFieldRootProps & { class?: HTMLAttributes["class"] }
>();

const emit = defineEmits<{ "update:modelValue": [val: number] }>();
</script>

<template>
  <NumberFieldRoot
    v-bind="props"
    :class="cn('flex items-center', props.class)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <NumberFieldDecrement
      class="h-9 px-2 border border-input rounded-l-md bg-transparent hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
    >
      <ChevronDown class="h-4 w-4" />
    </NumberFieldDecrement>
    <NumberFieldInput
      :class="
        cn(
          'border-y border-input h-9 min-w-0 flex-1 bg-transparent px-3 py-1 text-base md:text-sm text-center',
          'placeholder:text-muted-foreground outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )
      "
    />
    <NumberFieldIncrement
      class="h-9 px-2 border border-input rounded-r-md bg-transparent hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
    >
      <ChevronUp class="h-4 w-4" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
