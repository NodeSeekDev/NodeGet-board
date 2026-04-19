/*
Handles functionalities related to agent configuration, such as 
- feature enablement
- node migration to the primary controller
-  and similar tasks.

*/

import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useBackendExtra } from "@/composables/useBackendExtra";

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

  allow_task?: boolean;
  allow_icmp_ping?: boolean;
  allow_tcp_ping?: boolean;
  allow_http_ping?: boolean;

  allow_web_shell?: boolean;
  allow_edit_config?: boolean;
  allow_read_config?: boolean;
  allow_execute?: boolean;
  allow_http_request?: boolean;
  allow_ip?: boolean;

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

    // 对于 server 数组中的 allow_* 属性，设置默认值为 true
    if (config.server && Array.isArray(config.server)) {
      config.server = config.server.map((server) => ({
        allow_task: true,
        allow_icmp_ping: true,
        allow_tcp_ping: true,
        allow_http_ping: true,
        allow_web_shell: true,
        allow_edit_config: true,
        allow_read_config: true,
        allow_execute: true,
        allow_http_request: true,
        allow_ip: true,
        ...server, // 用原始值覆盖默认值
      }));
    }

    return config;
  } catch (e) {
    throw new Error(
      `Failed to parse TOML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
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
    return parseToml(tomlStr);
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

function writeRawAgentConfig(
  agentUuid: string,
  tomlContent: string,
  timeoutMs: number = 5000,
): Promise<boolean> {
  const { createEditConfigTask } = useTask(currentBackend);

  return createEditConfigTask(agentUuid, tomlContent, true, timeoutMs).then(
    (response: any) => {
      if ("edit_config" in response.task_event_result) {
        return response.task_event_result.edit_config;
      }
      throw new Error("Failed to write agent config");
    },
  );
}

function writeAgentConfig(
  agentUuid: string,
  config: AgentConfig,
  timeoutMs: number = 5000,
): Promise<boolean> {
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
