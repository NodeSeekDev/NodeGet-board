import { ref, watch } from "vue";
import type { PermissionEntry } from "../../type";

export const usePermissionModuleOpen = (
  getEntries: () => PermissionEntry[] | undefined,
) => {
  const isOpen = ref(false);
  let lastAutoOpen = false;

  watch(
    getEntries,
    (value) => {
      const nextAutoOpen = (value?.length ?? 0) > 0;

      if (isOpen.value === lastAutoOpen) {
        isOpen.value = nextAutoOpen;
      }

      lastAutoOpen = nextAutoOpen;
    },
    { immediate: true, deep: true },
  );

  const handleToggle = (event: Event) => {
    isOpen.value = (event.currentTarget as HTMLDetailsElement).open;
  };

  return {
    isOpen,
    handleToggle,
  };
};
