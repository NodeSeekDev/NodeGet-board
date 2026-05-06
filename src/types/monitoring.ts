export interface DynamicMonitoringSummaryData {
  uuid: string;
  time: number;
  cpu_usage?: number;
  gpu_usage?: number;
  used_swap?: number;
  total_swap?: number;
  used_memory?: number;
  total_memory?: number;
  available_memory?: number;
  load_one?: number;
  load_five?: number;
  load_fifteen?: number;
  uptime?: number;
  boot_time?: number;
  process_count?: number;
  total_space?: number;
  available_space?: number;
  read_speed?: number;
  write_speed?: number;
  tcp_connections?: number;
  udp_connections?: number;
  total_received?: number;
  total_transmitted?: number;
  transmit_speed?: number;
  receive_speed?: number;
}

type StrictRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

export type FullDynamicMonitoringSummaryData =
  StrictRequired<DynamicMonitoringSummaryData>;

export interface DynamicSummaryResponseItem {
  uuid: string;
  timestamp: number;
  cpu_usage?: number;
  gpu_usage?: number;
  used_swap?: number;
  total_swap?: number;
  used_memory?: number;
  total_memory?: number;
  available_memory?: number;
  load_one?: number;
  load_five?: number;
  load_fifteen?: number;
  uptime?: number;
  boot_time?: number;
  process_count?: number;
  total_space?: number;
  available_space?: number;
  read_speed?: number;
  write_speed?: number;
  tcp_connections?: number;
  udp_connections?: number;
  total_received?: number;
  total_transmitted?: number;
  transmit_speed?: number;
  receive_speed?: number;
}

export interface StaticMonitoringData {
  uuid: string;
  time: number;
  cpu: {
    brand: string;
    per_core: Array<{
      id: number;
      brand: string;
      frequency: number;
    }>;
  };
  system: {
    system_name: string;
    system_host_name: string;
    system_version: string;
    system_kernel_version: string;
    cpu_arch: string;
  };
  gpu: Array<{
    id: number;
    name: string;
    vendor: string;
  }>;
}

export interface StaticResponseItem {
  uuid: string;
  timestamp: number;
  cpu?: StaticMonitoringData["cpu"];
  system?: StaticMonitoringData["system"];
  gpu?: StaticMonitoringData["gpu"];
}

export type SummaryField = keyof Omit<
  DynamicMonitoringSummaryData,
  "uuid" | "time"
>;

export interface DynamicCpuCore {
  id: number;
  cpu_usage: number;
  frequency_mhz: number;
}

export interface DynamicCpu {
  total_cpu_usage: number;
  per_core: DynamicCpuCore[];
}

export interface DynamicDisk {
  kind: "HDD" | "SSD" | "Unknown";
  name: string;
  file_system: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  read_speed: number;
  write_speed: number;
  is_removable: boolean;
  is_read_only: boolean;
}

export interface DynamicNetworkInterface {
  interface_name: string;
  total_received: number;
  total_transmitted: number;
  receive_speed: number;
  transmit_speed: number;
}

export interface DynamicNetwork {
  interfaces: DynamicNetworkInterface[];
  tcp_connections: number;
  udp_connections: number;
}

export interface DynamicDetailData {
  uuid: string;
  timestamp: number;
  cpu?: DynamicCpu;
  disk?: DynamicDisk[];
  network?: DynamicNetwork;
}

export const DYNAMIC_SUMMARY_FIELDS: SummaryField[] = [
  "cpu_usage",
  "gpu_usage",
  "used_swap",
  "total_swap",
  "used_memory",
  "total_memory",
  "available_memory",
  "load_one",
  "load_five",
  "load_fifteen",
  "uptime",
  "boot_time",
  "process_count",
  "total_space",
  "available_space",
  "read_speed",
  "write_speed",
  "tcp_connections",
  "udp_connections",
  "total_received",
  "total_transmitted",
  "transmit_speed",
  "receive_speed",
] as const;
