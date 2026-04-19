import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

export type KvEntry = { key: string; value: unknown };

export function useKv() {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const backendToken = computed(() => currentBackend.value?.token ?? "");

  const namespace = ref("");
  const namespaces = ref<string[]>([]);
  const namespacesLoading = ref(false);
  const entries = ref<KvEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  const fetchNamespaces = async () => {
    if (!backendUrl.value) return;
    namespacesLoading.value = true;
    try {
      const list = await rpc<string[]>("kv_list_all_namespace", {
        token: backendToken.value,
      });
      namespaces.value = Array.isArray(list) ? list : [];
    } catch (e: unknown) {
      namespaces.value = [];
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      namespacesLoading.value = false;
    }
  };

  const fetchKeys = async () => {
    if (!namespace.value) return;
    loading.value = true;
    error.value = null;
    try {
      const results = await rpc<
        { namespace: string; key: string; value: unknown }[]
      >("kv_get_multi_value", {
        token: backendToken.value,
        namespace_key: [{ namespace: namespace.value, key: "*" }],
      });
      entries.value = Array.isArray(results)
        ? results.map((r) => ({ key: r.key, value: r.value }))
        : [];
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      entries.value = [];
    } finally {
      loading.value = false;
    }
  };

  const getMultiValue = async (
    namespaceKeys: { namespace: string; key: string }[],
  ): Promise<{ namespace: string; key: string; value: unknown }[]> => {
    const results = await rpc<
      { namespace: string; key: string; value: unknown }[]
    >("kv_get_multi_value", {
      token: backendToken.value,
      namespace_key: namespaceKeys,
    });
    return Array.isArray(results) ? results : [];
  };

  const getValue = async (key: string): Promise<unknown> => {
    const cached = entries.value.find((e) => e.key === key);
    if (cached?.value !== undefined) return cached.value;
    return rpc<unknown>("kv_get_value", {
      token: backendToken.value,
      namespace: namespace.value,
      key,
    });
  };

  const setValue = async (key: string, value: unknown): Promise<void> => {
    try {
      JSON.stringify(value);
    } catch {
      throw new Error("value 必须是可序列化的 JSON");
    }
    await rpc("kv_set_value", {
      token: backendToken.value,
      namespace: namespace.value,
      key,
      value,
    });
    const actual = await rpc<unknown>("kv_get_value", {
      token: backendToken.value,
      namespace: namespace.value,
      key,
    });
    const entry = entries.value.find((e) => e.key === key);
    if (entry) {
      entry.value = actual;
    } else {
      entries.value.push({ key, value: actual });
    }
  };

  const setValueBatch = async (
    items: Array<{ key: string; value: unknown }>,
  ): Promise<{ partialFailures: string[] }> => {
    for (const { value } of items) {
      try {
        JSON.stringify(value);
      } catch {
        throw new Error("value 必须是可序列化的 JSON");
      }
    }

    const conn = getWsConnection(backendUrl.value);
    const results = await conn.callBatch<{
      success: boolean;
      message?: string;
    }>(
      items.map(({ key, value }) => ({
        method: "kv_set_value",
        params: {
          token: backendToken.value,
          namespace: namespace.value,
          key,
          value,
        },
      })),
    );

    const partialFailures: string[] = [];
    results.forEach((result, i) => {
      const item = items[i]!;
      if (result?.success === false) {
        partialFailures.push(
          item.key + (result.message ? `：${result.message}` : ""),
        );
      } else {
        const entry = entries.value.find((e) => e.key === item.key);
        if (entry) {
          entry.value = item.value;
        } else {
          entries.value.push({ key: item.key, value: item.value });
        }
      }
    });

    return { partialFailures };
  };

  const deleteKey = async (key: string): Promise<void> => {
    await rpc("kv_delete_key", {
      token: backendToken.value,
      namespace: namespace.value,
      key,
    });
    entries.value = entries.value.filter((e) => e.key !== key);
  };

  const deleteNamespace = async (
    ns: string,
  ): Promise<{ partialFailures: string[] }> => {
    const results = await getMultiValue([{ namespace: ns, key: "*" }]);
    const keys = results.map((r) => r.key);
    // const keys = await rpc<
    //     string[]
    //   >("kv_get_all_keys", {
    //     token: backendToken.value,
    //     namespace: ns,
    //   });

    if (keys.length === 0) {
      namespaces.value = namespaces.value.filter((n) => n !== ns);
      return { partialFailures: [] };
    }

    const conn = getWsConnection(backendUrl.value);
    const batchResults = await conn.callBatch<{
      success: boolean;
      message?: string;
    }>(
      keys.map((key) => ({
        method: "kv_delete_key",
        params: { token: backendToken.value, namespace: ns, key },
      })),
    );

    const partialFailures: string[] = [];
    batchResults.forEach((r, i) => {
      if (r?.success === false) {
        partialFailures.push(keys[i]! + (r.message ? `：${r.message}` : ""));
      }
    });

    if (partialFailures.length === 0) {
      namespaces.value = namespaces.value.filter((n) => n !== ns);
      if (namespace.value === ns) entries.value = [];
    }

    return { partialFailures };
  };

  const createNamespace = async (ns: string): Promise<void> => {
    await rpc("kv_create", { token: backendToken.value, namespace: ns });
  };

  const listAgentUuids = async (): Promise<string[]> => {
    const result = await rpc<{ uuids: string[] }>(
      "nodeget-server_list_all_agent_uuid",
      {
        token: backendToken.value,
      },
    );
    return Array.isArray(result?.uuids) ? result.uuids : [];
  };

  // Initialize by fetching namespace list
  const init = async () => {
    if (!backendUrl.value) return;
    await fetchNamespaces();
  };

  return {
    namespace,
    namespaces,
    namespacesLoading,
    entries,
    loading,
    init,
    fetchNamespaces,
    fetchKeys,
    getValue,
    getMultiValue,
    setValue,
    setValueBatch,
    deleteKey,
    deleteNamespace,
    createNamespace,
    listAgentUuids,
  };
}
