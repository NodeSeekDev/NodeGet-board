import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { type Backend } from "@/composables/useBackendStore";
import type { JsWorker, JsResult, JsWorkerOptions } from "@/types/worker";
import { unicodeToBase64 } from "@/lib/base64";
import { delay } from "@/lib/delay";

export type { JsWorker, JsResult, JsWorkerOptions };

export function useJsRuntime(backend = useBackendStore().currentBackend) {
  const backendUrl = computed(() => backend.value?.url ?? "");
  const backendToken = computed(() => backend.value?.token ?? "");

  const workers = ref<JsWorker[]>([]);
  const loading = ref(false);

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  /**
   * 列出可见脚本
   * 列出当前 Token 可见且真实存在于数据库中的脚本名。
   * API: js-worker_list_all_js_worker
   *
   * @returns {Promise<string[]>} 包含可见脚本名词的数组
   */
  const listAllWorkers = async (): Promise<string[]> => {
    if (!backendUrl.value) return [];
    return await rpc<string[]>("js-worker_list_all_js_worker", {
      token: backendToken.value,
    });
  };

  /**
   * 获取 Runtime 池信息
   * 查看当前 JS Runtime 池状态（每个工作线程池活跃请求数，上次使用时间，空闲时间等）。
   * API: js-worker_get_rt_pool
   */
  const getRtPool = async () => {
    if (!backendUrl.value) return null;
    return await rpc<any>("js-worker_get_rt_pool", {
      token: backendToken.value,
    });
  };

  /**
   * 添加新脚本
   * API: js-worker_create
   *
   * @param {JsWorkerOptions} options 参数对象
   */
  const addWorker = async (options: JsWorkerOptions) => {
    if (!backendUrl.value) return;

    const contentBase64 = unicodeToBase64(options.content);
    return await rpc<any>("js-worker_create", {
      token: backendToken.value,
      name: options.name,
      js_script_base64: contentBase64,
      route_name: options.routeName,
      runtime_clean_time: options.runtimeCleanTime,
      env: options.env,
      description: options.description,
    });
  };

  /**
   * 删除脚本
   * 删除成功后，脚本对应的 Runtime 实例会被立即驱逐。
   * API: js-worker_delete
   *
   * @param {string} name 脚本名称
   */
  const deleteWorker = async (name: string) => {
    if (!backendUrl.value) return;

    await rpc("js-worker_delete", {
      token: backendToken.value,
      name,
    });
  };

  /**
   * 读取脚本信息
   * API: js-worker_read
   *
   * @param {string} name 脚本名
   * @returns 脚本信息对象
   */
  const getWorker = async (name: string): Promise<JsWorker | null> => {
    if (!backendUrl.value) return null;

    const res = await rpc<any>("js-worker_read", {
      token: backendToken.value,
      name,
    });

    if (!res) return null;

    let decodedContent = "";
    try {
      if (res.js_script_base64) {
        decodedContent = decodeURIComponent(escape(atob(res.js_script_base64)));
      }
    } catch {
      decodedContent = "// Base64 Decode Error";
    }

    return {
      id: res.name, // backend replaced id with name entirely
      name: res.name,
      route: res.route_name || "",
      content: decodedContent,
      created_at: res.create_at || 0,
      updated_at: res.update_at || 0,
      env: res.env || {},
      runtime_clean_time: res.runtime_clean_time,
      description: res.description || "",
    };
  };

  /**
   * 更新脚本
   * 更新后会重新预编译字节码，已存在的 Runtime 实例会被立即驱逐。
   * API: js-worker_update
   *
   * @param {string} name 脚本名称
   * @param {Partial<JsWorker>} updates 更新属性，例如 content, route, runtime_clean_time 和 env
   */
  const updateWorker = async (name: string, updates: Partial<JsWorker>) => {
    if (!backendUrl.value) return;

    const params: any = {
      token: backendToken.value,
      name,
      ...updates,
    };
    if (updates.route !== undefined) {
      params.route_name = updates.route;
      delete params.route;
    }
    if (updates.content !== undefined) {
      params.js_script_base64 = unicodeToBase64(updates.content as string);
      delete params.content;
    }
    return await rpc<any>("js-worker_update", params);
  };

  /**
   * 运行特定类型的脚本
   * run 不会等待脚本执行结束。它只负责将任务推入，并返回一条记录 ID。
   * 执行结果请通过 js-result_query 异步查询。
   * API: js-worker_run
   *
   * @param {string} name 脚本名 (js_script_name)
   * @param {"call"|"cron"|"route"} runType 运行类型：call / cron / route
   * @param {any} params 任意 JSON，传给脚本入口函数第一个参数
   * @param {any} [options] 额外选项，包括 env, compile_mode 以及 HTTP 模拟参数
   */
  const runWorker = async (
    name: string,
    runType: "call" | "cron" | "route",
    params: any,
    options: {
      env?: any;
      compile_mode?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ) => {
    if (!backendUrl.value) return;

    return await rpc<{ id: number }>("js-worker_run", {
      token: backendToken.value,
      js_script_name: name,
      run_type: runType,
      params,
      ...options,
    });
  };

  /**
   * 查询 JS 运行结果
   * API: js-result_query
   */
  const getWorkerLogs = async (condition: any[]): Promise<JsResult[]> => {
    if (!backendUrl.value) return [];
    const results = await rpc<JsResult[]>("js-result_query", {
      token: backendToken.value,
      query: {
        condition,
      },
    });
    return results || [];
  };

  /**
   * 轮询 JS 运行结果
   * API: js-result_query
   */
  const poolingWorkerLogs = async (
    workerId: number,
    timeout: number = 5000,
  ): Promise<JsResult> => {
    const delayPerTime = 100;
    for (let t = 0; t < timeout; t += delayPerTime) {
      await delay(delayPerTime);
      const result = await getWorkerLogs([
        {
          id: workerId,
        },
        {
          last: null,
        },
      ]);
      if (result[0]?.finish_time) {
        return result[0];
      }
    }
    throw "failed to get js worker result";
  };

  /**
   * 删除 JS 运行结果
   * API: js-result_delete
   */
  const deleteWorkerLog = async (id: number): Promise<void> => {
    if (!backendUrl.value) return;
    await rpc("js-result_delete", {
      token: backendToken.value,
      id,
    });
  };

  return {
    workers,
    loading,
    listAllWorkers,
    getRtPool,
    addWorker,
    deleteWorker,
    getWorker,
    updateWorker,
    runWorker,
    getWorkerLogs,
    poolingWorkerLogs,
    deleteWorkerLog,
    backendUrl,
  };
}
