import type {
  FullDynamicSummaryResponseItem,
  StaticMonitoringData,
} from "@/types/monitoring";

export interface StatusServer extends FullDynamicSummaryResponseItem {
  system?: StaticMonitoringData["system"];
  cpu_static?: StaticMonitoringData["cpu"];
  gpu: StaticMonitoringData["gpu"];
  online?: boolean;
}
