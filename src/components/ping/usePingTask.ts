import { ref, onUnmounted } from "vue";
import { type PingNode, type ISP, PING_NODES } from "@/data/pingNodes";

export interface PingResult {
  node: PingNode;
  taskId?: number;
  status: "pending" | "running" | "success" | "failed";
  latency: number | null;
  fastest: number | null;
  slowest: number | null;
  avg: number | null;
  jitter: number | null;
  sent: number;
  loss: number;
  latencyHistory: number[];
  qualityBars: Array<number | null>;
}

export type PingStatus = "idle" | "running" | "done";

const WORKER_START_INTERVAL_MS = 150;

export function usePingTask(uuid: string, url: string, token: string) {
  const results = ref<PingResult[]>([]);
  const pingStatus = ref<PingStatus>("idle");

  let ws: WebSocket | null = null;
  let nextId = 1;
  let stopped = false;
  const pendingRequests = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  >();

  function initResults(nodes: PingNode[]) {
    results.value = nodes.map((node) => ({
      node,
      taskId: undefined,
      status: "pending",
      latency: null,
      fastest: null,
      slowest: null,
      avg: null,
      jitter: null,
      sent: 0,
      loss: 0,
      latencyHistory: [],
      qualityBars: [],
    }));
  }

  function handleMessage(event: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.warn("[PingTask] Failed to parse message:", event.data);
      return;
    }
    if (msg.id != null && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id)!;
      pendingRequests.delete(msg.id);
      msg.error ? reject(msg.error) : resolve(msg.result);
    }
  }

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(url);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection error"));
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        ws = null;
      };
    });
  }

  function sendRequest(method: string, params: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }
      const id = nextId++;
      pendingRequests.set(id, { resolve, reject });
      const payload = { jsonrpc: "2.0", id, method, params };
      try {
        ws.send(JSON.stringify(payload));
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.get(id)!.reject(new Error("Request timed out"));
            pendingRequests.delete(id);
          }
        }, 30000);
      } catch (e) {
        pendingRequests.delete(id);
        reject(e);
      }
    });
  }

  async function createTask(
    host: string,
    testType: "ping" | "tcp_ping",
  ): Promise<number | null> {
    try {
      const task_type =
        testType === "tcp_ping" ? { tcp_ping: `${host}:80` } : { ping: host };
      const params: Record<string, unknown> = {
        token,
        target_uuid: uuid,
        task_type,
      };
      const res = await sendRequest("task_create_task", params);
      return (res as any)?.id ?? (res as any)?.task_id ?? null;
    } catch (e) {
      console.error("[PingTask] createTask failed:", e);
      return null;
    }
  }

  async function queryTask(taskId: number): Promise<any> {
    try {
      return await sendRequest("task_query", {
        token,
        task_data_query: { condition: [{ task_id: taskId }, "last"] },
      });
    } catch (e) {
      console.error("[PingTask] queryTask failed:", e);
      return null;
    }
  }

  function updateResult(index: number, raw: any, pushBar = false) {
    const result = results.value[index];
    if (!result || !raw) return;

    const data = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (!data) return;

    result.sent += 1;

    if (!data.success) {
      const failures = result.sent - result.latencyHistory.length;
      result.loss = Math.round((failures / result.sent) * 100);
      result.status = "failed";
      if (pushBar) result.qualityBars.push(null);
      return;
    }

    const ev = data.task_event_result;
    const latency: number | null = ev?.ping ?? ev?.tcp_ping ?? null;

    if (latency !== null) {
      result.latencyHistory.push(latency);
      if (result.latencyHistory.length > 20) result.latencyHistory.shift();
    }

    const history = result.latencyHistory;
    result.latency = latency;
    result.avg = history.length
      ? history.reduce((a, b) => a + b, 0) / history.length
      : null;
    result.fastest = history.length ? Math.min(...history) : null;
    result.slowest = history.length ? Math.max(...history) : null;
    result.loss = Math.round(
      ((result.sent - history.length) / result.sent) * 100,
    );
    result.status = "success";

    if (history.length >= 2) {
      let sum = 0;
      for (let i = 1; i < history.length; i++) {
        sum += Math.abs(history[i]! - history[i - 1]!);
      }
      result.jitter = sum / (history.length - 1);
    } else {
      result.jitter = null;
    }

    if (pushBar) {
      result.qualityBars.push(latency ?? null);
    }
  }

  /**
   * 单次探测：为指定节点建任务并查询一次结果（用于 continuous 广度优先调度）
   */
  async function runSingleProbe(
    index: number,
    nodes: PingNode[],
    testType: "ping" | "tcp_ping",
    delayBeforeQueryMs: number,
    isFirstProbe: boolean,
  ): Promise<void> {
    const node = nodes[index]!;
    const taskId = await createTask(node.host, testType);
    if (taskId === null) {
      results.value[index]!.qualityBars.push(null);
      return;
    }
    if (isFirstProbe) {
      results.value[index]!.taskId = taskId;
      results.value[index]!.status = "running";
    }
    await new Promise((r) => setTimeout(r, delayBeforeQueryMs));
    if (stopped) return;
    const data = await queryTask(taskId);
    updateResult(index, data, true);
  }

  /**
   * 处理单个节点：建任务 → 轮询直到有结果（用于非 continuous 模式）
   */
  async function processNode(
    index: number,
    nodes: PingNode[],
    testType: "ping" | "tcp_ping",
    delayBeforeQueryMs: number,
  ): Promise<void> {
    const node = nodes[index]!;

    const taskId = await createTask(node.host, testType);
    if (taskId === null) {
      if (results.value[index]) results.value[index]!.status = "failed";
      return;
    }

    if (results.value[index]) {
      results.value[index]!.taskId = taskId;
      results.value[index]!.status = "running";
    }

    await new Promise((r) => setTimeout(r, delayBeforeQueryMs));

    while (!stopped) {
      const data = await queryTask(taskId);
      updateResult(index, data);

      const status = results.value[index]?.status;
      if (status === "success" || status === "failed") break;

      await new Promise((r) => setTimeout(r, delayBeforeQueryMs));
    }
  }

  /**
   * 滑动窗口 worker：从共享队列取节点，处理完立刻取下一个（仅用于非 continuous 模式）
   */
  async function worker(
    queue: number[],
    nodes: PingNode[],
    testType: "ping" | "tcp_ping",
    delayBeforeQueryMs: number,
    startDelay: number = 0,
  ): Promise<void> {
    if (startDelay > 0) await new Promise((r) => setTimeout(r, startDelay));
    while (!stopped) {
      const index = queue.shift();
      if (index === undefined) break; // 队列已空，worker 退出
      await processNode(index, nodes, testType, delayBeforeQueryMs);
    }
  }

  async function start(
    testType: "ping" | "tcp_ping",
    ispFilter: ISP | "all",
    continuous: boolean,
    concurrency: number = 1,
    delayBeforeQueryMs: number = 1000,
    loopCount: number = 100,
  ) {
    stop();
    stopped = false;

    const nodes =
      ispFilter === "all"
        ? PING_NODES
        : PING_NODES.filter((n) => n.isp === ispFilter);
    initResults(nodes);
    pingStatus.value = "running";

    try {
      await connect();
    } catch (e) {
      console.error("[PingTask] connect failed:", e);
      pingStatus.value = "done";
      return;
    }

    if (continuous) {
      // 广度优先：外层按轮次，内层并发跑所有节点
      for (let probe = 0; probe < loopCount && !stopped; probe++) {
        const nodeQueue = Array.from({ length: nodes.length }, (_, i) => i);
        await Promise.allSettled(
          Array.from({ length: Math.min(concurrency, nodes.length) }, () =>
            (async () => {
              while (!stopped) {
                const index = nodeQueue.shift();
                if (index === undefined) break;
                await runSingleProbe(
                  index,
                  nodes,
                  testType,
                  delayBeforeQueryMs,
                  probe === 0,
                );
              }
            })(),
          ),
        );
      }
      if (!stopped) {
        results.value.forEach((r) => {
          if (r.status === "running") r.status = "success";
        });
        pingStatus.value = "done";
      }
    } else {
      // 非 continuous 模式：滑动窗口 worker 队列调度
      const queue = Array.from({ length: nodes.length }, (_, i) => i);
      await Promise.allSettled(
        Array.from({ length: Math.min(concurrency, nodes.length) }, (_, i) =>
          worker(
            queue,
            nodes,
            testType,
            delayBeforeQueryMs,
            i * WORKER_START_INTERVAL_MS,
          ),
        ),
      );
      if (!stopped) pingStatus.value = "done";
    }
  }

  function stop() {
    stopped = true;
    if (ws) {
      ws.onmessage = null;
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    pendingRequests.forEach(({ reject }) => reject(new Error("Ping stopped")));
    pendingRequests.clear();
    if (pingStatus.value === "running") {
      pingStatus.value = "done";
    }
  }

  onUnmounted(stop);

  return { results, pingStatus, start, stop };
}
