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
