import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import type { JsWorker, JsResult } from "@/types/worker";

export type { JsWorker, JsResult };

export function useJsRuntime() {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const backendToken = computed(() => currentBackend.value?.token ?? "");

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
   * @param {Object} options 参数对象
   * @param {string} options.name 脚本的唯一名称 (js_script_name)
   * @param {string} options.content Base64 编码前的 UTF-8 JS 源码
   * @param {string} [options.routeName] 可选。若设置则开启 HTTP 路由入口，对应路径前缀为 /worker-route/{route_name}
   * @param {number} [options.runtimeCleanTime] 脚本 Runtime 空闲清理时间（毫秒），null 表示不自动清理
   * @param {Record<string, any>} [options.env] 可选，任意 JSON 结构，存入数据库并可在运行时传给脚本
   */
  const addWorker = async (options: {
    name: string;
    content: string;
    routeName?: string | null;
    runtimeCleanTime?: number | null;
    env?: Record<string, any>;
    description?: string;
  }) => {
    if (!backendUrl.value) return;

    const contentBase64 = btoa(unescape(encodeURIComponent(options.content)));
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
      params.js_script_base64 = btoa(
        unescape(encodeURIComponent(updates.content as string)),
      );
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
   * @param {"call"|"cron"} runType 运行类型：call / cron
   * @param {any} params 任意 JSON，传给脚本入口函数第一个参数
   * @param {any} [env] 传入时使用请求里的 env；不传则使用数据库中保存的 env
   */
  const runWorker = async (
    name: string,
    runType: "call" | "cron",
    params: any,
    env?: any,
  ) => {
    if (!backendUrl.value) return;

    return await rpc<{ id: number }>("js-worker_run", {
      token: backendToken.value,
      js_script_name: name,
      run_type: runType,
      params,
      env,
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
    deleteWorkerLog,
  };
}
