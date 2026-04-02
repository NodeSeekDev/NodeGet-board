import { ref } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { mockWorkers, mockRunResult } from "@/mocks/jsRuntimeData";
import type { JsWorker } from "@/types/worker";

/**
 * 是否启用 Mock 模式 (代码级开关，方便开发者随时切换)
 * true: 强制使用 Mock 数据
 * false: 优先使用真实后端接口
 */
const MOCK_ENABLED = true;

export function useJsRuntime() {
  const { currentBackend } = useBackendStore();

  const workers = ref<JsWorker[]>([]);
  const loading = ref(false);

  const isMockMode = () => {
    if (MOCK_ENABLED) return true;
    if (!currentBackend.value?.url) return true;
    return false;
  };

  const fetchWorkers = async () => {
    if (isMockMode()) {
      loading.value = true;
      await new Promise((r) => setTimeout(r, 500));
      workers.value = [...mockWorkers];
      loading.value = false;
      return;
    }

    const backend = currentBackend.value;
    if (!backend) return;

    loading.value = true;
    try {
      const result = await getWsConnection(backend.url).call<JsWorker[]>(
        "js-worker_list",
        { token: backend.token },
      );
      workers.value = result || [];
    } catch (e) {
      console.error("Failed to fetch workers", e);
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const addWorker = async (name: string, content: string) => {
    const performMockAdd = () => {
      const newWorker: JsWorker = {
        id: "worker_" + Math.random().toString(36).slice(2, 9),
        name,
        route: "/" + name.toLowerCase().replace(/\s+/g, "-"),
        content,
        created_at: Date.now(),
        updated_at: Date.now(),
        env: {},
        runtime_clean_time: "1h",
      };
      mockWorkers.push(newWorker);
      workers.value = [...mockWorkers];
      return newWorker;
    };

    if (isMockMode()) return performMockAdd();

    const backend = currentBackend.value;
    if (!backend) return;

    const contentBase64 = btoa(unescape(encodeURIComponent(content)));
    return await getWsConnection(backend.url).call<JsWorker>(
      "js-worker_create",
      {
        token: backend.token,
        name,
        js_script_base64: contentBase64,
      },
    );
  };

  const deleteWorker = async (id: string) => {
    const performMockDelete = () => {
      const idx = mockWorkers.findIndex((w) => w.id === id);
      if (idx !== -1) mockWorkers.splice(idx, 1);
      workers.value = [...mockWorkers];
    };

    if (isMockMode()) return performMockDelete();

    const backend = currentBackend.value;
    if (!backend) return;

    await getWsConnection(backend.url).call("js-worker_delete", {
      token: backend.token,
      id,
    });
  };

  const getWorker = async (id: string) => {
    if (isMockMode()) return mockWorkers.find((w) => w.id === id) || null;

    const backend = currentBackend.value;
    if (!backend) return null;

    return await getWsConnection(backend.url).call<JsWorker>("js-worker_get", {
      token: backend.token,
      id,
    });
  };

  const updateWorker = async (id: string, updates: Partial<JsWorker>) => {
    const performMockUpdate = () => {
      const idx = workers.value.findIndex((w) => w.id === id);
      const existing = workers.value[idx];
      if (existing) {
        const updated: JsWorker = {
          ...existing,
          ...updates,
          id: existing.id,
          updated_at: Date.now(),
        };
        workers.value[idx] = updated;
        const mockIdx = mockWorkers.findIndex((w) => w.id === id);
        if (mockIdx !== -1) mockWorkers.splice(mockIdx, 1, updated);
        return updated;
      }
      return null;
    };

    if (isMockMode()) return performMockUpdate();

    const backend = currentBackend.value;
    if (!backend) return;

    const params: any = {
      token: backend.token,
      id,
      ...updates,
    };
    if (updates.content) {
      params.js_script_base64 = btoa(
        unescape(encodeURIComponent(updates.content)),
      );
      delete params.content;
    }
    return await getWsConnection(backend.url).call<JsWorker>(
      "js-worker_update",
      params,
    );
  };

  const runWorker = async (
    id: string,
    runType: "call" | "cron",
    params: any,
    env: any,
  ) => {
    if (isMockMode()) {
      await new Promise((r) => setTimeout(r, 300));
      return mockRunResult(id, runType, params, env);
    }

    const backend = currentBackend.value;
    if (!backend) return;

    return await getWsConnection(backend.url).call("js-worker_run", {
      token: backend.token,
      id,
      run_type: runType,
      params,
      env,
    });
  };

  return {
    workers,
    loading,
    fetchWorkers,
    addWorker,
    deleteWorker,
    getWorker,
    updateWorker,
    runWorker,
  };
}
