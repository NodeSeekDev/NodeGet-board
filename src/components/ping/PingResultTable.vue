<script setup lang="ts">
import { computed } from "vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PingResult } from "./usePingTask";
import type { ISP } from "@/data/pingNodes";
import { ISP_LABELS } from "@/data/pingNodes";

const props = defineProps<{ results: PingResult[] }>();

function getLatencyColor(latency: number | null, loss: number): string {
  if (loss >= 100) return "#991b1b";
  if (latency === null) return "#6b7280";
  if (latency < 50) return "#16a34a";
  if (latency < 80) return "#65a30d";
  if (latency < 120) return "#ca8a04";
  if (latency < 200) return "#ea580c";
  return "#dc2626";
}

function fmt(v: number | null): string {
  return v === null ? "—" : `${Math.round(v)}`;
}

function fmtLoss(v: number): string {
  return v === 0 ? "0%" : `${v.toFixed(0)}%`;
}

function ispColor(
  isp: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (isp === "telecom") return "default";
  if (isp === "unicom") return "secondary";
  return "outline";
}

function calculateDelay(num1: number, num2: number): string {
  let delay = 0x2800;
  if (num1 > 0 && num1 <= 80) delay += 0x40;
  else if (num1 > 80 && num1 <= 160) delay += 0x44;
  else if (num1 > 160 && num1 <= 240) delay += 0x46;
  else if (num1 > 240) delay += 0x47;
  if (num2 > 0 && num2 <= 80) delay += 0x80;
  else if (num2 > 80 && num2 <= 160) delay += 0xa0;
  else if (num2 > 160 && num2 <= 240) delay += 0xb0;
  else if (num2 > 240) delay += 0xb8;
  return String.fromCodePoint(delay);
}

function buildBrailleQuality(latencyHistory: number[], loss: number): string {
  if (latencyHistory.length === 0 && loss >= 100) return "⣿⣿⣿⣿⣿";
  if (latencyHistory.length === 0) return "—";
  let result = "";
  for (let i = 0; i + 1 < latencyHistory.length; i += 2) {
    result += calculateDelay(latencyHistory[i]!, latencyHistory[i + 1]!);
  }
  if (latencyHistory.length % 2 === 1) {
    const last = latencyHistory[latencyHistory.length - 1]!;
    result += calculateDelay(last, last);
  }
  return result.padEnd(5, "⠀");
}

const ISP_ORDER: ISP[] = ["telecom", "unicom", "mobile", "international"];

const groups = computed(() =>
  ISP_ORDER.map((isp) => ({
    isp,
    label: ISP_LABELS[isp],
    rows: props.results.filter((r) => r.node.isp === isp),
  })).filter((g) => g.rows.length > 0),
);
</script>

<template>
  <div class="border rounded-lg overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[100px]">地点</TableHead>
          <TableHead class="font-mono text-xs">IP</TableHead>
          <TableHead class="text-right">丢包</TableHead>
          <TableHead class="text-right">发包</TableHead>
          <TableHead class="text-right">最新ms</TableHead>
          <TableHead class="text-right">最快ms</TableHead>
          <TableHead class="text-right">最慢ms</TableHead>
          <TableHead class="text-right">平均ms</TableHead>
          <TableHead class="text-center">网络质量示意图</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="group in groups" :key="group.isp">
          <!-- 运营商分组标题行 -->
          <TableRow class="bg-muted/50 hover:bg-muted/50">
            <TableCell colspan="9" class="py-1.5 px-3">
              <Badge :variant="ispColor(group.isp)" class="text-xs">
                {{ group.label }}
              </Badge>
              <span class="ml-2 text-xs text-muted-foreground"
                >{{ group.rows.length }} 个节点</span
              >
            </TableCell>
          </TableRow>
          <!-- 该运营商下各省节点（按省份顺序） -->
          <TableRow
            v-for="r in group.rows"
            :key="r.node.host"
            :class="r.status === 'pending' ? 'opacity-40' : ''"
          >
            <TableCell>
              <span class="text-sm">{{
                r.node.isp === "international"
                  ? r.node.location
                  : r.node.province
              }}</span>
            </TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">{{
              r.node.host
            }}</TableCell>
            <TableCell class="text-right text-sm">
              <span :class="r.loss > 0 ? 'text-red-500 font-medium' : ''">
                {{ r.status === "pending" ? "—" : fmtLoss(r.loss) }}
              </span>
            </TableCell>
            <TableCell class="text-right text-sm font-mono">
              {{ r.status === "pending" ? "—" : r.sent }}
            </TableCell>
            <TableCell class="text-right font-mono text-sm font-medium">
              <span :style="{ color: getLatencyColor(r.latency, r.loss) }">
                {{ r.status === "pending" ? "—" : fmt(r.latency) }}
              </span>
            </TableCell>
            <TableCell class="text-right font-mono text-sm text-green-600">
              {{ r.status === "pending" ? "—" : fmt(r.fastest) }}
            </TableCell>
            <TableCell class="text-right font-mono text-sm text-red-500">
              {{ r.status === "pending" ? "—" : fmt(r.slowest) }}
            </TableCell>
            <TableCell class="text-right font-mono text-sm font-bold">
              <span :style="{ color: getLatencyColor(r.avg, r.loss) }">
                {{ r.status === "pending" ? "—" : fmt(r.avg) }}
              </span>
            </TableCell>
            <TableCell class="text-center">
              <span
                class="font-mono tracking-widest text-sm"
                :style="{
                  color:
                    r.status === 'pending'
                      ? undefined
                      : getLatencyColor(r.avg, r.loss),
                }"
              >
                {{
                  r.status === "pending"
                    ? "—"
                    : buildBrailleQuality(r.latencyHistory, r.loss)
                }}
              </span>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
