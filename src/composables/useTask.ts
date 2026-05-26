import { computed, ref } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  TASK_NAME_LIST,
  type TASK_NAME,
  type PingTask,
  type TcpPingTask,
  type HttpPingTask,
  type HttpRequestTask,
  type SelfUpdateTask,
  type WebShellTask,
  type ExecuteTask,
  type ReadConfigTask,
  type EditConfigTask,
  type IpTask,
  type VersionTask,
  type TaskRequest,
  type PingResult,
  type TcpPingResult,
  type HttpPingResult,
  type HttpRequestResult,
  type SelfUpdateResult,
  type WebShellResult,
  type ExecuteResult,
  type ReadConfigResult,
  type EditConfigResult,
  type IpResult,
  type VersionResult,
  type TaskEventResult,
  type TaskQueryCondition,
  type TaskRecord,
  type CreateTaskResponse,
  type CreateTaskBlockingResponse,
  type DeleteTaskResponse,
} from "@/types/task";
export * from "@/types/task";

export function useTask(backend = useBackendStore().currentBackend) {
  const backendUrl = computed(() => backend.value?.url ?? "");
  const backendToken = computed(() => backend.value?.token ?? "");

  const rpc = <T>(
    method: string,
    params: unknown,
    timeoutMs: number = 5000,
  ): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params, timeoutMs);

  /**
   * 创建并下发任务给 Agent
   */
  const createTask = async (
    targetUuid: string,
    taskType: TaskRequest,
  ): Promise<CreateTaskResponse> => {
    return rpc<CreateTaskResponse>("task_create_task", {
      token: backendToken.value,
      target_uuid: targetUuid,
      task_type: taskType,
    });
  };

  /**
   * 创建任务并阻塞等待 Agent 返回结果
   */
  const createTaskBlocking = async <T>(
    targetUuid: string,
    taskType: TaskRequest,
    timeoutMs: number = 5000,
  ) => {
    return rpc<CreateTaskBlockingResponse<T>>(
      "task_create_task_blocking",
      {
        token: backendToken.value,
        target_uuid: targetUuid,
        task_type: taskType,
        timeout_ms: timeoutMs,
      },
      timeoutMs + 200, // ms
    );
  };

  /**
   * 查询任务执行记录
   */
  const query = async (
    conditions: TaskQueryCondition[],
  ): Promise<TaskRecord[]> => {
    return rpc<TaskRecord[]>("task_query", {
      token: backendToken.value,
      task_data_query: {
        condition: conditions,
      },
    });
  };

  /**
   * 查询指定 Agent 的任务记录
   */
  const queryByUuid = async (
    uuid: string,
    limit: number = 100,
  ): Promise<TaskRecord[]> => {
    return query([{ uuid }, { limit }]);
  };

  /**
   * 查询指定类型的任务记录
   */
  const queryByType = async (
    type: string,
    limit: number = 100,
  ): Promise<TaskRecord[]> => {
    return query([{ type }, { limit }]);
  };

  /**
   * 查询最近的任务记录
   */
  const queryRecent = async (limit: number = 100): Promise<TaskRecord[]> => {
    return query([{ limit }]);
  };

  /**
   * 删除任务执行记录
   */
  const deleteRecords = async (
    conditions: TaskQueryCondition[],
  ): Promise<DeleteTaskResponse> => {
    return rpc<DeleteTaskResponse>("task_delete", {
      token: backendToken.value,
      conditions,
    });
  };

  /**
   * 删除指定 Agent 的所有任务记录
   */
  const deleteByUuid = async (uuid: string): Promise<DeleteTaskResponse> => {
    return deleteRecords([{ uuid }]);
  };

  /**
   * 删除指定类型的任务记录
   */
  const deleteByType = async (type: string): Promise<DeleteTaskResponse> => {
    return deleteRecords([{ type }]);
  };

  /**
   * 删除指定时间范围内的任务记录
   */
  const deleteByTimeRange = async (
    from: number,
    to: number,
  ): Promise<DeleteTaskResponse> => {
    return deleteRecords([{ timestamp_from_to: [from, to] }]);
  };

  // Convenience methods for creating specific task types
  const createPingTask = async <T extends boolean = false>(
    targetUuid: string,
    target: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true ? CreateTaskBlockingResponse<PingResult> : CreateTaskResponse
  > => {
    const taskType: PingTask = { ping: target };
    return (
      blocking
        ? createTaskBlocking<PingResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createTcpPingTask = async <T extends boolean = false>(
    targetUuid: string,
    target: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<TcpPingResult>
      : CreateTaskResponse
  > => {
    const taskType: TcpPingTask = { tcp_ping: target };
    return (
      blocking
        ? createTaskBlocking<TcpPingResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createHttpPingTask = async <T extends boolean = false>(
    targetUuid: string,
    url: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<HttpPingResult>
      : CreateTaskResponse
  > => {
    const taskType: HttpPingTask = { http_ping: url };
    return (
      blocking
        ? createTaskBlocking<HttpPingResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createHttpRequestTask = async <T extends boolean = false>(
    targetUuid: string,
    config: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: string;
      body_base64?: string;
      ip?: string;
    },
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<HttpRequestResult>
      : CreateTaskResponse
  > => {
    const taskType: HttpRequestTask = { http_request: config };
    return (
      blocking
        ? createTaskBlocking<HttpRequestResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createSelfUpdateTask = async <T extends boolean = false>(
    targetUuid: string,
    version: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<SelfUpdateResult>
      : CreateTaskResponse
  > => {
    const taskType: SelfUpdateTask = { self_update: version };
    return (
      blocking
        ? createTaskBlocking<SelfUpdateResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createExecuteTask = async <T extends boolean = false>(
    targetUuid: string,
    cmd: string,
    args: string[] = [],
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<ExecuteResult>
      : CreateTaskResponse
  > => {
    const taskType: ExecuteTask = { execute: { cmd, args } };
    return (
      blocking
        ? createTaskBlocking<ExecuteResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createWebShellTask = async (
    targetUuid: string,
    url: string,
    terminalId: string = crypto.randomUUID(),
  ): Promise<CreateTaskResponse> => {
    const taskType: WebShellTask = {
      web_shell: { url, terminal_id: terminalId },
    };
    return createTask(targetUuid, taskType);
  };

  const createReadConfigTask = async <T extends boolean = false>(
    targetUuid: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<ReadConfigResult>
      : CreateTaskResponse
  > => {
    const taskType: ReadConfigTask = "read_config";
    return (
      blocking
        ? createTaskBlocking<ReadConfigResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createEditConfigTask = async <T extends boolean = false>(
    targetUuid: string,
    configContent: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<EditConfigResult>
      : CreateTaskResponse
  > => {
    const taskType: EditConfigTask = { edit_config: configContent };
    return (
      blocking
        ? createTaskBlocking<EditConfigResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createIpTask = async <T extends boolean = false>(
    targetUuid: string,
    blocking: T = false as T,
    timeoutMs?: number,
  ): Promise<
    T extends true ? CreateTaskBlockingResponse<IpResult> : CreateTaskResponse
  > => {
    const taskType: IpTask = "ip";
    return (
      blocking
        ? createTaskBlocking<IpResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  const createVersionTask = async <T extends boolean = true>(
    targetUuid: string,
    blocking: T,
    timeoutMs?: number,
  ): Promise<
    T extends true
      ? CreateTaskBlockingResponse<VersionResult>
      : CreateTaskResponse
  > => {
    const taskType: VersionTask = "version";
    return (
      blocking
        ? createTaskBlocking<VersionResult>(targetUuid, taskType, timeoutMs)
        : createTask(targetUuid, taskType)
    ) as any;
  };

  return {
    createTask,
    createTaskBlocking,
    query,
    queryByUuid,
    queryByType,
    queryRecent,
    deleteRecords,
    deleteByUuid,
    deleteByType,
    deleteByTimeRange,
    // Convenience methods
    createPingTask,
    createTcpPingTask,
    createHttpPingTask,
    createHttpRequestTask,
    createSelfUpdateTask,
    createExecuteTask,
    createWebShellTask,
    createReadConfigTask,
    createEditConfigTask,
    createIpTask,
    createVersionTask,
  };
}
