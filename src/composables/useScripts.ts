import { ref, watch } from "vue";
import { useKv } from "./useKv";

export interface Script {
  name: string;
  lang: "shell" | "js";
  content: string;
  order: number;
  created_at: number;
  updated_at: number;
}

export function useScripts() {
  const {
    namespace,
    namespaces,
    fetchNamespaces,
    createNamespace,
    getMultiValue,
    setValue,
    deleteKey,
    setValueBatch,
  } = useKv();
  const scriptNamespace = "script_snippet";
  const scripts = ref<Script[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  /**
   * 初始化 namespace，如果不存在就创建
   */
  const initNamespace = async () => {
    await fetchNamespaces();
    if (!namespaces.value.includes(scriptNamespace)) {
      await createNamespace(scriptNamespace);
    }
    namespace.value = scriptNamespace; // 切换到 script namespace
  };

  /**
   * 获取 script namespace 下的所有脚本
   */
  const fetchScripts = async () => {
    loading.value = true;
    error.value = null;
    try {
      const kvGetScripts = await getMultiValue([
        { namespace: namespace.value, key: "*" },
      ]);
      console.log(kvGetScripts);
      // 将 KV 的 value 转为 Script
      scripts.value = kvGetScripts
        .map((e) => {
          try {
            const parsed = e.value as Script;
            if (parsed && parsed.name) return parsed;
          } catch {
            return null;
          }
          return null;
        })
        .filter(Boolean) as Script[];
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      scripts.value = [];
    } finally {
      loading.value = false;
    }
  };

  const add = async (script: Script) => {
    await setValue(script.name, script);
    await fetchScripts();
  };

  const del = async (name: string) => {
    await deleteKey(name);
    await fetchScripts();
  };

  const init = async () => {
    await initNamespace();
    await fetchScripts();
  };

  init();

  return {
    scripts,
    loading,
    error,
    fetchScripts,
    add,
    del,
  };
}
