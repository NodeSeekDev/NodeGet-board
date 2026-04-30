import { computed, ref } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

// Task Event Types
export interface PingTask {
  ping: string; // 目标地址或域名
}

export interface TcpPingTask {
  tcp_ping: string; // 目标地址:端口
}

export interface HttpPingTask {
  http_ping: string; // 完整 URL
}

export interface HttpRequestTask {
  http_request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    body_base64?: string;
    ip?: string; // "ipv4 auto" | "ipv6 auto" | 具体IP
  };
}

export interface WebShellTask {
  web_shell: {
    url: string;
    terminal_id: string; // UUID
  };
}

export interface ExecuteTask {
  execute: {
    cmd: string;
    args: string[];
  };
}

type ReadConfigTask = "read_config";

export interface EditConfigTask {
  edit_config: string; // 完整 TOML 字符串
}

type IpTask = "ip";

type VersionTask = "version";

export type TaskEventType =
  | PingTask
  | TcpPingTask
  | HttpPingTask
  | HttpRequestTask
  | WebShellTask
  | ExecuteTask
  | ReadConfigTask
  | EditConfigTask
  | IpTask
  | VersionTask;

// Task Event Results
export interface PingResult {
  ping: number; // 延迟 ms
}

export interface TcpPingResult {
  tcp_ping: number; // 延迟 ms
}

export interface HttpPingResult {
  http_ping: number; // 延迟 ms
}

export interface HttpRequestResult {
  http_request: {
    status: number;
    headers: Record<string, string>[];
    body?: string;
    body_base64?: string;
  };
}

export interface WebShellResult {
  web_shell: boolean; // Is Connected
}

export interface ExecuteResult {
  execute: string; // 命令输出
}

export interface ReadConfigResult {
  read_config: string; // config.toml 原文
}

export interface EditConfigResult {
  edit_config: boolean; // 是否成功写入
}

export interface IpResult {
  ip: [string | null, string | null]; // [IPv4, IPv6]
}

export interface VersionResult {
  version: {
    binary_type: string;
    cargo_version: string;
    git_branch: string;
    git_commit_sha: string;
    git_commit_date: string; // ISO 8601
    git_commit_message: string;
    build_time: string; // 看起来是时间戳（字符串形式）
    cargo_target_triple: string;
    rustc_channel: "stable" | "beta" | "nightly" | string;
    rustc_version: string;
    rustc_commit_date: string; // YYYY-MM-DD
    rustc_commit_hash: string;
    rustc_llvm_version: string;
  };
}

export type TaskEventResult =
  | PingResult
  | TcpPingResult
  | HttpPingResult
  | HttpRequestResult
  | WebShellResult
  | ExecuteResult
  | ReadConfigResult
  | VersionResult
  | IpResult;

// Query Conditions
export type TaskQueryCondition =
  | { task_id: number }
  | { uuid: string }
  | { timestamp_from_to: [number, number] }
  | { timestamp_from: number }
  | { timestamp_to: number }
  | { is_success?: boolean }
  | { is_failure?: boolean }
  | { is_running?: boolean }
  | { type: string }
  | { cron_source: string }
  | { limit: number }
  | { last: string };

// Task Record
export interface TaskRecord {
  task_id: number;
  uuid: string;
  timestamp: number;
  success: boolean;
  error_message: string | null;
  task_event_type: TaskEventType;
  task_event_result: TaskEventResult | null;
  cron_source: string | null;
}

// Create Task Response
export interface CreateTaskResponse {
  id: number;
}

// Create Task Blocking Response
export interface CreateTaskBlockingResponse {
  task_id: number;
  agent_uuid: string;
  task_token: string;
  timestamp: number;
  success: boolean;
  error_message: string | null;
  task_event_result: TaskEventResult | null;
}

// Delete Task Response
export interface DeleteTaskResponse {
  success: boolean;
  deleted: number;
  condition_count: number;
}

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
    taskType: TaskEventType,
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
  const createTaskBlocking = async (
    targetUuid: string,
    taskType: TaskEventType,
    timeoutMs: number = 5000,
  ): Promise<CreateTaskBlockingResponse> => {
    return rpc<CreateTaskBlockingResponse>(
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
  const createPingTask = async (
    targetUuid: string,
    target: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: PingTask = { ping: target };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createTcpPingTask = async (
    targetUuid: string,
    target: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: TcpPingTask = { tcp_ping: target };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createHttpPingTask = async (
    targetUuid: string,
    url: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: HttpPingTask = { http_ping: url };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createHttpRequestTask = async (
    targetUuid: string,
    config: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: string;
      body_base64?: string;
      ip?: string;
    },
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: HttpRequestTask = { http_request: config };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createExecuteTask = async (
    targetUuid: string,
    cmd: string,
    args: string[] = [],
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: ExecuteTask = { execute: { cmd, args } };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
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

  const createReadConfigTask = async (
    targetUuid: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: ReadConfigTask = "read_config";
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createEditConfigTask = async (
    targetUuid: string,
    configContent: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: EditConfigTask = { edit_config: configContent };
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createIpTask = async (
    targetUuid: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: IpTask = "ip";
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
  };

  const createVersionTask = async (
    targetUuid: string,
    blocking: boolean = false,
    timeoutMs?: number,
  ): Promise<CreateTaskResponse | CreateTaskBlockingResponse> => {
    const taskType: VersionTask = "version";
    return blocking
      ? createTaskBlocking(targetUuid, taskType, timeoutMs)
      : createTask(targetUuid, taskType);
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
    createExecuteTask,
    createWebShellTask,
    createReadConfigTask,
    createEditConfigTask,
    createIpTask,
    createVersionTask,
  };
}
