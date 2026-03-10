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
import PingQualityCanvas from "./PingQualityCanvas.vue";
import { getLatencyColor } from "./pingLatencyConfig";

const props = defineProps<{ results: PingResult[]; loopCount: number }>();

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
  <div>
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
          <TableHead class="text-center w-[220px]">网络质量示意图</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="group in groups" :key="group.isp">
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
            <TableCell class="text-center w-[220px]">
              <PingQualityCanvas
                v-if="r.qualityBars.length > 0"
                :bars="r.qualityBars"
                :loop-count="loopCount"
                class="mx-auto"
              />
              <span v-else class="text-muted-foreground text-xs">—</span>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
