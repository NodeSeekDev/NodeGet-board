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

const props = defineProps<NumberFieldRootProps & { class?: HTMLAttributes["class"] }>();

const emit = defineEmits<{ "update:modelValue": [val: number] }>();
</script>

<template>
  <NumberFieldRoot
    v-bind="props"
    :class="cn('flex items-center', props.class)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <NumberFieldDecrement
      class="border-input hover:bg-accent h-9 rounded-l-md border bg-transparent px-2 transition-colors disabled:pointer-events-none disabled:opacity-50"
    >
      <ChevronDown class="h-4 w-4" />
    </NumberFieldDecrement>
    <NumberFieldInput
      :class="
        cn(
          'border-input h-9 min-w-0 flex-1 border-y bg-transparent px-3 py-1 text-center text-base md:text-sm',
          'placeholder:text-muted-foreground outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )
      "
    />
    <NumberFieldIncrement
      class="border-input hover:bg-accent h-9 rounded-r-md border bg-transparent px-2 transition-colors disabled:pointer-events-none disabled:opacity-50"
    >
      <ChevronUp class="h-4 w-4" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
