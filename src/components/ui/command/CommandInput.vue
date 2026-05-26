<script setup lang="ts">
import type { ListboxFilterProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { Search } from "lucide-vue-next";
import { ListboxFilter, useForwardProps } from "reka-ui";
import { computed, watch } from "vue";
import { cn } from "@/lib/utils";
import { useCommand } from ".";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<
    ListboxFilterProps & {
      class?: HTMLAttributes["class"];
    }
  >(),
  {
    autoFocus: true,
  },
);
const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const delegatedProps = reactiveOmit(props, "class", "modelValue");

const forwardedProps = useForwardProps(delegatedProps);

const { filterState } = useCommand();

const inputValue = computed({
  get: () => filterState.search,
  set: (value: string) => {
    filterState.search = value;
    emit("update:modelValue", value);
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== filterState.search) {
      filterState.search = value;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="flex h-9 items-center gap-2 border-b px-3"
  >
    <Search class="size-4 shrink-0 opacity-50" />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="inputValue"
      data-slot="command-input"
      :class="
        cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
    />
  </div>
</template>
