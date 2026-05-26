/*
Handles functionalities related to agent configuration, such as 
- feature enablement
- node migration to the primary controller
-  and similar tasks.

*/

import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useBackendExtra } from "@/composables/useBackendExtra";
import { type TASK_NAME, TASK_NAME_LIST } from "@/types/task";
import { compareVersions } from "compare-versions";

import {
  useTask,
  type CreateTaskBlockingResponse,
} from "@/composables/useTask";
import TOML from "smol-toml";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
export type TerminalShell = "bash" | "cmd";

export interface UpstreamServer {
  name: string;
  server_uuid: string;
  token: string;
  ws_url: string;

  allow_task?: true;
  allow_icmp_ping?: boolean;
  allow_tcp_ping?: boolean;
  allow_http_ping?: boolean;

  allow_web_shell?: boolean;
  allow_edit_config?: boolean;
  allow_read_config?: boolean;
  allow_execute?: boolean;
  allow_http_request?: boolean;
  allow_self_update?: boolean;
  allow_ip?: boolean;
  allow_version?: boolean;
  allow_task_type?: TASK_NAME[];

  ignore_cert?: boolean;

  [key: string]: any;
}

export interface BasicAgentConfig {
  log_level: LogLevel;
  agent_uuid: string;

  // dynamic_report_interval_ms必须是dynamic_summary_report_interval_ms的整数倍
  dynamic_report_interval_ms: number;
  dynamic_summary_report_interval_ms: number;
  static_report_interval_ms: number;

  terminal_shell: TerminalShell;
  exec_max_character: number;

  ip_provider: "ipinfo" | "cloudflare";

  [key: string]: any;
  connect_timeout_ms: number;

  dynamic_summary_select_disk?: string[];
  dynamic_summary_select_network_interface?: string[];
}

export interface AgentConfig extends BasicAgentConfig {
  server: UpstreamServer[];
}

const { currentBackend } = useBackendStore();
const { createReadConfigTask } = useTask(currentBackend);
const { currentBackendInfo, refreshAll } = useBackendExtra();

function getRawAgentConfig(
  agentUuid: string,
  timeoutMs: number = 9000,
): Promise<string> {
  return createReadConfigTask(agentUuid, true, timeoutMs).then(
    (response: any) => {
      if ("read_config" in response.task_event_result) {
        return response.task_event_result.read_config;
      }
      throw new Error("Failed to read agent config");
    },
  );
}

/**
 * 使用标准TOML库解析配置
 */
function parseToml(tomlStr: string): AgentConfig {
  try {
    const config = TOML.parse(tomlStr) as AgentConfig;

    if (config.server && Array.isArray(config.server)) {
      config.server = config.server.map((server) => {
        if (server.allow_task_type) {
          return server;
        }
        return {
          allow_task: true,
          allow_icmp_ping: false,
          allow_tcp_ping: false,
          allow_http_ping: false,
          allow_web_shell: false,
          allow_edit_config: false,
          allow_read_config: false,
          allow_execute: false,
          allow_http_request: false,
          allow_self_update: false,
          allow_ip: false,
          allow_version: false,
          ...server, // 用原始值覆盖默认值
        };
      });
    }

    return config;
  } catch (e) {
    throw new Error(
      `Failed to parse TOML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function oldUpstream2New(upstream: UpstreamServer) {
  const upstream2: UpstreamServer = JSON.parse(JSON.stringify(upstream));
  const allow_task_type: Array<TASK_NAME> = [];
  TASK_NAME_LIST.forEach((t) => {
    if (t === "ping") {
      if (upstream2["allow_icmp_ping"]) {
        allow_task_type.push(t as TASK_NAME);
        delete upstream2["allow_icmp_ping"];
      }
      return;
    }
    if (upstream2["allow_" + t]) {
      allow_task_type.push(t as TASK_NAME);
      delete upstream2["allow_" + t];
    }
  });
  delete upstream2.allow_task;
  upstream2.allow_task_type = allow_task_type;
  upstream2.allow_task = true;
  return upstream2;
}

function cleanNewUpstream(upstream: UpstreamServer) {
  const upstream2: UpstreamServer = JSON.parse(JSON.stringify(upstream));
  TASK_NAME_LIST.forEach((t) => {
    if (t === "ping") {
      delete upstream2["allow_icmp_ping"];
      return;
    }
    delete upstream2["allow_" + t];
  });
  upstream2.allow_task = true;
  return upstream2;
}

function newUpstream2Old(upstream: UpstreamServer) {
  const upstream2: UpstreamServer = JSON.parse(JSON.stringify(upstream));
  if (!Array.isArray(upstream2.allow_task_type)) {
    throw "not new upstream";
  }
  const att = new Set(upstream2.allow_task_type);
  TASK_NAME_LIST.forEach((t) => {
    if (t === "ping") {
      upstream2["allow_icmp_ping"] = att.has(t);
      return;
    }
    upstream2["allow_" + t] = att.has(t);
  });
  delete upstream2.allow_task_type;
  upstream2.allow_task = true;
  return upstream2;
}

/**
 * 使用标准TOML库序列化配置
 */
function serializeToml(config: AgentConfig): string {
  try {
    return TOML.stringify(config as any);
  } catch (e) {
    throw new Error(
      `Failed to serialize TOML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function getAgentConfig(
  agentUuid: string,
  timeoutMs: number = 5000,
): Promise<AgentConfig> {
  return getRawAgentConfig(agentUuid, timeoutMs).then((tomlStr) => {
    const config = parseToml(tomlStr);
    config.server = config.server.map((v) => {
      if (Array.isArray(v.allow_task_type)) {
        return v;
      }
      return oldUpstream2New(v);
    });
    // return new config format
    return config;
  });
}

export type splitConfig = {
  upstreams: UpstreamServer[];
  currentUpstream: UpstreamServer;
  otherUpstreams: UpstreamServer[];
  basicConfig: BasicAgentConfig;
};

async function getAgentConfigExtra(
  agentUuid: string,
  timeoutMs: number = 5000,
): Promise<splitConfig> {
  const [cfg, _] = await Promise.all([
    getAgentConfig(agentUuid, timeoutMs),
    refreshAll(),
  ]);
  const upstreams = cfg.server;
  const currentUpstream = cfg.server.find(
    (v) => v.server_uuid === currentBackendInfo.value?.uuid,
  ) as UpstreamServer;
  const otherUpstreams = cfg.server.filter(
    (v) => v.server_uuid !== currentBackendInfo.value?.uuid,
  );
  const basicConfig = {
    ...cfg,
    server: undefined,
  };
  return {
    upstreams,
    currentUpstream,
    otherUpstreams,
    basicConfig,
  };
}

async function writeRawAgentConfig(
  agentUuid: string,
  tomlContent: string,
  timeoutMs: number = 5000,
): Promise<boolean> {
  const { createEditConfigTask, query: queryTask } = useTask(currentBackend);

  const task = await createEditConfigTask(agentUuid, tomlContent, false);
  for (let t = 0; t < timeoutMs; t += 1000) {
    const r = await queryTask([{ task_id: task.id }]);
    if (!r.length) {
      continue;
    }
    if (!r[0]) {
      continue;
    }
    return r[0].success;
  }
  throw new Error("Failed to write agent config");
}

async function writeAgentConfig(
  agentUuid: string,
  config: AgentConfig,
  timeoutMs: number = 5000,
): Promise<boolean> {
  const { createVersionTask } = useTask(currentBackend);

  const versonResult = await createVersionTask(agentUuid, true);
  const version = versonResult.task_event_result?.version;

  if (!version) {
    throw "failed to get agent version";
  }
  if (compareVersions(version.cargo_version, "0.3.0") < 0) {
    config.server = config.server.map((v) => newUpstream2Old(v));
  } else {
    config.server = config.server.map((v) => cleanNewUpstream(v));
  }

  const tomlContent = serializeToml(config);
  return writeRawAgentConfig(agentUuid, tomlContent, timeoutMs);
}

export function useAgentConfig() {
  return {
    getRawAgentConfig,
    getAgentConfig,
    writeRawAgentConfig,
    writeAgentConfig,
    getAgentConfigExtra,
  };
}
