import { useAgentConfig, type AgentConfig } from "@/composables/useAgentConfig";
import { compareVersions } from "compare-versions";
import { upgradeTokenLimit } from "@/components/agents/generateToken";

export const postProcesses: Record<
  string,
  ((...arg: any[]) => Promise<any>)[]
> = {
  "0.3.7": [enableDnsTask],
};

export async function applyPostProces(
  agentUUID: string,
  oldVersion: string,
  newVersion: string,
) {
  const breakPoints = Array.from(Object.keys(postProcesses))
    .sort(compareVersions)
    .filter(
      (bpVer) =>
        compareVersions(bpVer, oldVersion) > 0 &&
        compareVersions(bpVer, newVersion) <= 0,
    );
  for (let i = 0, len = breakPoints.length; i < len; i++) {
    const bp = breakPoints[i] as string;
    const processes = postProcesses[bp];
    if (!processes) {
      continue;
    }
    for (let j = 0, len2 = processes?.length as number; j < len2; j++) {
      const p = processes[j];
      if (p) {
        await p(agentUUID);
      }
    }
  }
}

async function enableDnsTask(agentUUID: string) {
  // enable config
  const { getAgentConfigExtra, writeAgentConfig } = useAgentConfig();
  const config = await getAgentConfigExtra(agentUUID);
  if (!config.currentUpstream.allow_task_type) {
    return;
  }
  const exist = !!config.currentUpstream.allow_task_type.find(
    (v) => v === "dns",
  );
  if (!exist) {
    const newConfig: AgentConfig = {
      ...config.basicConfig,
      server: [
        ...config.otherUpstreams,
        {
          ...config.currentUpstream,
          allow_task_type: [...config.currentUpstream.allow_task_type, "dns"],
        },
      ],
    };
    await writeAgentConfig(agentUUID, newConfig);
  }
  // enable token
  await upgradeTokenLimit(agentUUID);
}
