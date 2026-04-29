import { formatBytes } from "@/utils/format";

export const showHostname = (server: any) => {
  if (server.system && server.system.system_host_name) {
    return server.system.system_host_name;
  }
  return "Server";
};

export const showOS = (server: any) => {
  const s = server?.system;
  if (!s?.system_name) return "Unknown OS";
  const name =
    s.system_name.replace(/\s*GNU\/Linux\s*$/i, "").trim() || s.system_name;
  const version = (
    s.system_version ??
    s.system_os_version ??
    s.system_os_long_version ??
    ""
  )
    .toString()
    .trim();
  return version ? `${name} ${version}` : name;
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

const formatSpeed = (bytes: number) => {
  if (!+bytes) return "0.00 KB/s";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(
    sizes.length - 1,
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))),
  );
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(2)} ${sizes[i]}/s`;
};

export const showNetworkSpeed = (server: any, type: "rx" | "tx" | "total") => {
  const rx = server.receive_speed ?? 0;
  const tx = server.transmit_speed ?? 0;
  if (type === "rx") return formatSpeed(rx);
  if (type === "tx") return formatSpeed(tx);
  return formatSpeed(rx + tx);
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

export const OFFLINE_AFTER_MS = 30_000;

export const isOnline = (server: any, now = Date.now()) => {
  const ts = server.timestamp;
  return typeof ts === "number" && now - ts < OFFLINE_AFTER_MS;
};

const DISTROS: { file: string; match: string[] }[] = [
  { file: "archlinux.svg", match: ["arch"] },
  { file: "manjaro.svg", match: ["manjaro"] },
  { file: "kali.svg", match: ["kali"] },
  { file: "ubuntu.svg", match: ["ubuntu"] },
  { file: "mint.svg", match: ["mint"] },
  { file: "debian.svg", match: ["debian"] },
  { file: "fedora.svg", match: ["fedora"] },
  { file: "rocky.svg", match: ["rocky"] },
  { file: "oracle.svg", match: ["oracle"] },
  { file: "redhat.svg", match: ["red hat", "redhat", "rhel", "almalinux"] },
  { file: "centos.svg", match: ["centos"] },
  { file: "gentoo.svg", match: ["gentoo"] },
  { file: "nixos.svg", match: ["nix"] },
  { file: "zorin.svg", match: ["zorin"] },
  { file: "freebsd.svg", match: ["freebsd", "bsd"] },
  { file: "windows.svg", match: ["windows", "microsoft"] },
];

export const distroLogo = (server: any) => {
  const s = server?.system ?? {};
  const hay = `${s.distribution_id ?? ""} ${s.system_name ?? ""} ${
    s.system_os_long_version ?? s.system_os_version ?? s.system_version ?? ""
  }`
    .toLowerCase()
    .trim();
  if (!hay) return "";
  for (const { file, match } of DISTROS) {
    if (match.some((k) => hay.includes(k))) return `/linux-logo-icon/${file}`;
  }
  return "/linux-logo-icon/linux.svg";
};

const VIRT_LABELS: Record<string, string> = {
  kvm: "KVM",
  lxc: "LXC",
  openvz: "OpenVZ",
  vmware: "VMware",
  hyperv: "Hyper-V",
  "hyper-v": "Hyper-V",
  xen: "Xen",
  docker: "Docker",
  wsl: "WSL",
  dedicated: "独服",
};

export const virtLabel = (server: any) => {
  const v = server?.system?.virtualization;
  if (!v) return "";
  const key = String(v).toLowerCase().trim();
  if (key === "none") return "";
  return VIRT_LABELS[key] ?? v;
};

export const flagUrl = (code?: string | null) => {
  const c = code?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return `https://flagcdn.com/${c.toLowerCase()}.svg`;
};
