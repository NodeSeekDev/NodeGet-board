import { getWsConnection } from "@/composables/useWsConnection";
import { useBackendStore } from "@/composables/useBackendStore";

export interface ExecuteTask {
  cmd: string;
  args: string[];
}

export interface Task {
  target_uuid: string;
  execute: ExecuteTask;
}

export interface TaskResult {
  uuid: string;
  taskId: string;
  status: 0 | 1 | -1; // 0: pending, 1: success, -1: failed
  result?: string;
  error?: string;
}

export async function createTasks(tasks: Task[]): Promise<TaskResult[]> {
  const { currentBackend } = useBackendStore();
  const backend = currentBackend.value;
  if (!backend) throw new Error("No backend selected");

  const conn = getWsConnection(backend.url);

  const results: TaskResult[] = [];

  for (const t of tasks) {
    try {
      const res: { id: string } = await conn.call("task_create_task", {
        token: backend.token,
        target_uuid: t.target_uuid,
        task_type: { execute: { ...t.execute } },
      });

      results.push({
        uuid: t.target_uuid,
        taskId: res.id,
        status: 0,
      });
    } catch (e: any) {
      results.push({
        uuid: t.target_uuid,
        taskId: "",
        status: -1,
        error: e.message || String(e),
      });
    }
  }

  return results;
}

export async function queryTaskResults(
  taskResults: TaskResult[],
): Promise<TaskResult[]> {
  const { currentBackend } = useBackendStore();
  const backend = currentBackend.value;
  if (!backend) throw new Error("No backend selected");

  const conn = getWsConnection(backend.url);

  const pendingTasks = taskResults.filter((r) => r.status === 0 && r.taskId);

  if (pendingTasks.length === 0) return taskResults;

  const taskIds = pendingTasks.map((r) => r.taskId);

  try {
    const queryResults: any[] = await conn.call("task_query", {
      token: backend.token,
      task_data_query: { condition: taskIds.map((id) => ({ task_id: id })) },
    });

    for (const qr of queryResults) {
      const r = taskResults.find((t) => t.taskId === qr.task_id);
      if (!r) continue;

      if (qr.success && qr.task_event_result?.execute !== undefined) {
        r.status = 1;
        r.result = qr.task_event_result.execute;
      } else if (qr.success === false) {
        r.status = -1;
        r.error = qr.error_message || "Task failed";
      }
    }
  } catch (e: any) {
    for (const r of pendingTasks) {
      r.status = -1;
      r.error = e.message || String(e);
    }
  }

  return taskResults;
}
