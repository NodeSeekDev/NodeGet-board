import { computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

export interface BackendCron {
  id: number;
  name: string;
  enable: boolean;
  cron_expression: string;
  cron_type:
    | { agent: [string[], { task: Record<string, unknown> }] }
    | { server: string }
    | { server: { js_worker: [string, { task: string }] } };
  last_run_time: number | null;
}

export type AgentTaskKind = "ping" | "tcp_ping" | "http_ping" | "execute";

export interface ExecuteTaskPayload {
  cmd: string;
  args: string[];
}

export interface CronTask {
  id: number;
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRunTime: number | null;
  taskKind: "agent" | "server";
  agentIds: string[];
  agentTaskType: AgentTaskKind;
  agentTaskTarget: string;
  agentExecuteCommand: string;
  agentExecuteArgs: string[];
  serverTask: string;
}

const normalizeTimestamp = (value: number | null) => {
  if (!value) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
};

export function backendToTask(b: BackendCron): CronTask {
  if ("agent" in b.cron_type) {
    const [ids, agentCron] = b.cron_type.agent;
    const task = agentCron.task;
    const taskType = (Object.keys(task)[0] ?? "ping") as AgentTaskKind;
    const executePayload =
      taskType === "execute" &&
      task[taskType] &&
      typeof task[taskType] === "object"
        ? (task[taskType] as Partial<ExecuteTaskPayload>)
        : null;
    const taskTarget =
      taskType === "execute" ? "" : String(task[taskType] ?? "");
    return {
      id: b.id,
      name: b.name,
      cronExpression: b.cron_expression,
      enabled: b.enable,
      lastRunTime: normalizeTimestamp(b.last_run_time),
      taskKind: "agent",
      agentIds: ids,
      agentTaskType: taskType,
      agentTaskTarget: taskTarget,
      agentExecuteCommand: executePayload?.cmd ?? "",
      agentExecuteArgs: Array.isArray(executePayload?.args)
        ? executePayload.args.map((arg) => String(arg))
        : [],
      serverTask: "",
    };
  } else {
    return {
      id: b.id,
      name: b.name,
      cronExpression: b.cron_expression,
      enabled: b.enable,
      lastRunTime: normalizeTimestamp(b.last_run_time),
      taskKind: "server",
      agentIds: [],
      agentTaskType: "ping",
      agentTaskTarget: "",
      agentExecuteCommand: "",
      agentExecuteArgs: [],
      serverTask: b.cron_type.server,
    };
  }
}

export function taskToCronType(
  task: Pick<
    CronTask,
    | "taskKind"
    | "agentIds"
    | "agentTaskType"
    | "agentTaskTarget"
    | "agentExecuteCommand"
    | "agentExecuteArgs"
    | "serverTask"
  >,
): BackendCron["cron_type"] {
  if (task.taskKind === "agent") {
    const taskPayload =
      task.agentTaskType === "execute"
        ? {
            execute: {
              cmd: task.agentExecuteCommand,
              args: task.agentExecuteArgs,
            },
          }
        : { [task.agentTaskType]: task.agentTaskTarget };

    return {
      agent: [task.agentIds, { task: taskPayload }],
    };
  }
  return { server: task.serverTask };
}

export function useCron(backend = useBackendStore().currentBackend) {
  const backendUrl = computed(() => backend.value?.url ?? "");
  const backendToken = computed(() => backend.value?.token ?? "");

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  const list = (): Promise<BackendCron[]> =>
    rpc<BackendCron[]>("crontab_get", { token: backendToken.value });

  const create = (params: {
    name: string;
    cron_expression: string;
    cron_type: BackendCron["cron_type"];
  }) => rpc("crontab_create", { token: backendToken.value, ...params });

  const edit = (params: {
    name: string;
    cron_expression: string;
    cron_type: BackendCron["cron_type"];
  }) => rpc("crontab_edit", { token: backendToken.value, ...params });

  const remove = (name: string) =>
    rpc("crontab_delete", { token: backendToken.value, name });

  const setEnable = (name: string, enable: boolean) =>
    rpc("crontab_set_enable", { token: backendToken.value, name, enable });

  const toggleEnable = (name: string) =>
    rpc("crontab_toggle_enable", { token: backendToken.value, name });

  return { list, create, edit, remove, setEnable, toggleEnable };
}
