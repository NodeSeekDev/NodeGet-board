import { formatBytes } from "@/utils/format";

export const showHostname = (server: any) => {
  if (server.system && server.system.system_host_name) {
    return server.system.system_host_name;
  }
  return "Server";
};

export const showOS = (server: any) => {
  if (server.system && server.system.system_name)
    return server.system.system_name;
  return "Unknown OS";
};

export const showCpuPercent = (server: any): number => {
  if (typeof server.cpu_usage === "number") return server.cpu_usage;
  // fallback for old nested structure
  if (server.cpu && typeof server.cpu.total_cpu_usage === "number")
    return server.cpu.total_cpu_usage;
  return 0;
};

export const showRamPercent = (server: any): number => {
  const used = server.used_memory ?? 0;
  const total = server.total_memory ?? 1;
  return (used / total) * 100;
};

export const showRamText = (server: any) => {
  const used = server.used_memory ?? 0;
  const total = server.total_memory ?? 0;
  return `${formatBytes(used)} / ${formatBytes(total)}`;
};

export const showNetworkSpeed = (server: any, type: "rx" | "tx" | "total") => {
  const rx = server.receive_speed ?? 0;
  const tx = server.transmit_speed ?? 0;
  if (type === "rx") return formatBytes(rx) + "/s";
  if (type === "tx") return formatBytes(tx) + "/s";
  return formatBytes(rx + tx) + "/s";
};

export const showDiskUsage = (server: any) => {
  const total = server.total_space ?? 0;
  const available = server.available_space ?? 0;
  if (total === 0) return "N/A";
  const used = total - available;
  const percent = (used / total) * 100;
  return `Disk: ${Math.round(percent)}%`;
};

export const showDiskPercent = (server: any) => {
  const total = server.total_space ?? 0;
  const available = server.available_space ?? 0;
  if (total === 0) return 0;
  return ((total - available) / total) * 100;
};

export const showDiskDisplay = (server: any) => {
  const total = server.total_space ?? 0;
  const available = server.available_space ?? 0;
  if (total === 0) return "N/A";
  const used = total - available;
  const percent = (used / total) * 100;
  return `${Math.round(percent)}%`;
};
