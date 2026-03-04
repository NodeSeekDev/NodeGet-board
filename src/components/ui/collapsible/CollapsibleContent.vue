<script setup lang="ts">
import { CollapsibleContent } from "reka-ui";
</script>

<template>
  <CollapsibleContent data-slot="collapsible-content">
    <slot />
  </CollapsibleContent>
</template>

<style scoped>
[data-slot="collapsible-content"] {
  overflow: hidden;
}

[data-slot="collapsible-content"][data-state="open"] {
  animation: collapsible-down 200ms ease-out;
}

[data-slot="collapsible-content"][data-state="closed"] {
  animation: collapsible-up 200ms ease-out;
}

@keyframes collapsible-down {
  from {
    height: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
  }
}

@keyframes collapsible-up {
  from {
    height: var(--reka-collapsible-content-height);
  }
  to {
    height: 0;
  }
}
</style>
