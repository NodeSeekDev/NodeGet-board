import { ref, watch } from "vue";

export interface Backend {
  name: string;
  url: string;
  token: string;
}

const LS_KEY_BACKENDS = "nodeget_backends";
const LS_KEY_CURRENT = "nodeget_current_backend";

const backends = ref<Backend[]>([]);
const currentBackend = ref<Backend | null>(null);

const init = () => {
  // Load backends from localStorage
  const storedBackends = localStorage.getItem(LS_KEY_BACKENDS);
  if (storedBackends) {
    try {
      const parsed = JSON.parse(storedBackends);
      if (Array.isArray(parsed)) {
        backends.value = parsed as Backend[];
      }
    } catch (e) {
      console.error("Failed to parse backends from localStorage", e);
      backends.value = [];
    }
  }

  const storedCurrent = localStorage.getItem(LS_KEY_CURRENT);
  if (storedCurrent) {
    try {
      const parsed = JSON.parse(storedCurrent);
      if (parsed && typeof parsed === "object") {
        currentBackend.value = parsed as Backend;
      }
    } catch (e) {
      console.error("Failed to parse current backend from localStorage", e);
    }
  }

  // If in dev mode, add dev backend
  if (import.meta.env.DEV && backends.value.length === 0) {
    const devBackend: Backend = {
      name: "Dev",
      url: import.meta.env.VITE_BACKEND_WS || "",
      token: import.meta.env.VITE_BACKEND_TOKEN || "",
    };
    if (devBackend.url && devBackend.token) {
      backends.value.push(devBackend);
      if (!currentBackend.value) {
        currentBackend.value = devBackend;
      }
    }
  }

  // If we have backends but no current, select first
  if (backends.value.length > 0 && !currentBackend.value) {
    currentBackend.value = backends.value[0] || null;
  } else if (backends.value.length === 0) {
    currentBackend.value = null;
  }
};

init();

watch(
  backends,
  (newVal) => {
    localStorage.setItem(LS_KEY_BACKENDS, JSON.stringify(newVal));
    if (currentBackend.value) {
      const found = newVal.find(
        (b) =>
          b.url === currentBackend.value?.url &&
          b.token === currentBackend.value?.token,
      );
      if (!found) {
        if (newVal.length > 0) {
          currentBackend.value = newVal[0] || null;
        } else {
          currentBackend.value = null;
        }
      }
    }
  },
  { deep: true },
);

watch(
  currentBackend,
  (newVal) => {
    if (newVal) {
      localStorage.setItem(LS_KEY_CURRENT, JSON.stringify(newVal));
    } else {
      localStorage.removeItem(LS_KEY_CURRENT);
    }
  },
  { deep: true },
);

const addBackend = (backend: Backend) => {
  backends.value.push(backend);
  if (!currentBackend.value) {
    currentBackend.value = backend;
  }
};

const removeBackend = (backend: Backend) => {
  const index = backends.value.findIndex(
    (b) => b.url === backend.url && b.token === backend.token,
  ); // Simple check
  if (index !== -1) {
    backends.value.splice(index, 1);
  }
};

const selectBackend = (backend: Backend) => {
  currentBackend.value = backend;
};

export function useBackendStore() {
  return {
    backends,
    currentBackend,
    addBackend,
    removeBackend,
    selectBackend,
  };
}
