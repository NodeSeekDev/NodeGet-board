<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuContent, DropdownMenuPortal } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  sideOffset?: number;
  align?: "start" | "center" | "end";
}>();
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :side-offset="props.sideOffset ?? 4"
      :align="props.align"
      :class="
        cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
