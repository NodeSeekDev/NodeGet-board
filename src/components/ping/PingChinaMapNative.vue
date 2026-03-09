<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import type { PingResult } from "./usePingTask";
import type { ISP } from "@/data/pingNodes";

const props = defineProps<{ results: PingResult[]; ispFilter: ISP | "all" }>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

// ECharts 地图 GeoJSON 使用全称，pingNodes 使用短名，需要做映射
const PROVINCE_FULL_NAME: Record<string, string> = {
  北京: "北京市",
  天津: "天津市",
  上海: "上海市",
  重庆: "重庆市",
  河北: "河北省",
  山西: "山西省",
  辽宁: "辽宁省",
  吉林: "吉林省",
  黑龙江: "黑龙江省",
  江苏: "江苏省",
  浙江: "浙江省",
  安徽: "安徽省",
  福建: "福建省",
  江西: "江西省",
  山东: "山东省",
  河南: "河南省",
  湖北: "湖北省",
  湖南: "湖南省",
  广东: "广东省",
  海南: "海南省",
  四川: "四川省",
  贵州: "贵州省",
  云南: "云南省",
  陕西: "陕西省",
  甘肃: "甘肃省",
  青海: "青海省",
  内蒙古: "内蒙古自治区",
  广西: "广西壮族自治区",
  西藏: "西藏自治区",
  宁夏: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
};

// 从 results 聚合每个省份的平均延迟，仅统计 ispFilter 选中的运营商
function buildProvinceData(results: PingResult[], ispFilter: ISP | "all") {
  const map = new Map<
    string,
    {
      latencies: number[];
      hasCompleted: boolean;
      ispData: Partial<
        Record<string, { latencies: number[]; hasCompleted: boolean }>
      >;
    }
  >();

  for (const r of results) {
    if (r.node.isp === "international") continue; // 海外节点不上中国地图
    const prov = r.node.province;
    if (!map.has(prov))
      map.set(prov, { latencies: [], hasCompleted: false, ispData: {} });
    const entry = map.get(prov)!;
    const isp = r.node.isp;

    // ① 始终更新 ispData（不受 ispFilter 限制）
    if (!entry.ispData[isp])
      entry.ispData[isp] = { latencies: [], hasCompleted: false };
    const ispEntry = entry.ispData[isp]!;
    if (r.status === "success" && r.avg !== null)
      ispEntry.latencies.push(r.avg);
    if (r.status === "success" || r.status === "failed")
      ispEntry.hasCompleted = true;

    // ② 受 ispFilter 限制，更新整体 latencies（用于地图着色）
    if (ispFilter === "all" || r.node.isp === ispFilter) {
      if (r.status === "success" && r.avg !== null) entry.latencies.push(r.avg);
      if (r.status === "success" || r.status === "failed")
        entry.hasCompleted = true;
    }
  }

  const getIspValue = (
    d: { latencies: number[]; hasCompleted: boolean } | undefined,
  ): number | null => {
    if (!d) return null;
    const avg =
      d.latencies.length > 0
        ? d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length
        : null;
    return avg !== null ? Math.round(avg) : d.hasCompleted ? 9999 : null;
  };

  return Array.from(map.entries()).map(
    ([name, { latencies, hasCompleted, ispData }]) => {
      const avg =
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : null;
      const value =
        avg !== null
          ? Math.round(avg)
          : hasCompleted && latencies.length === 0
            ? 9999
            : null;

      const telecom = getIspValue(ispData["telecom"]);
      const unicom = getIspValue(ispData["unicom"]);
      const mobile = getIspValue(ispData["mobile"]);

      const ispValues = [telecom, unicom, mobile].filter(
        (v): v is number => v !== null,
      );
      const fastest = ispValues.length > 0 ? Math.min(...ispValues) : null;

      return {
        name: PROVINCE_FULL_NAME[name] ?? name,
        value,
        telecom,
        unicom,
        mobile,
        fastest,
      };
    },
  );
}

function initOption(): echarts.EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      showDelay: 0,
      transitionDuration: 0.2,
      formatter: (params: any) => {
        const d = params.data;
        if (!d) return `${params.name}：未测`;

        const fmt = (val: number | null): string => {
          if (val == null) return "未测";
          if (val >= 9999) return "超时";
          return `${val} ms`;
        };

        return [
          `<b>${params.name}</b>`,
          `最快响应：${fmt(d.fastest)}`,
          `电信：${fmt(d.telecom)}`,
          `联通：${fmt(d.unicom)}`,
          `移动：${fmt(d.mobile)}`,
        ].join("<br/>");
      },
    },
    visualMap: {
      type: "piecewise",
      left: "left",
      bottom: 16,
      pieces: [
        { gte: 9999, color: "#e6170f", label: "超时" },
        { gt: 250, lt: 9999, color: "#f69833", label: ">250ms" },
        { gt: 200, lte: 250, color: "#f6ed44", label: "201-250ms" },
        { gt: 100, lte: 200, color: "#bef663", label: "101-200ms" },
        { gt: 50, lte: 100, color: "#43dd3e", label: "51-100ms" },
        { gte: 0, lte: 50, color: "#26a91e", label: "≤50ms" },
      ],
      show: true,
    },
    series: [
      {
        name: "Ping",
        type: "map",
        map: "china",
        zoom: 1.25,
        center: [105, 29],
        roam: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 10 },
          itemStyle: { areaColor: "#93c5fd" },
        },
        select: { disabled: true },
        itemStyle: {
          areaColor: "#e5e7eb",
          borderColor: "#9ca3af",
          borderWidth: 0.5,
        },
        data: [],
      },
    ],
  };
}

onMounted(async () => {
  try {
    const geoJson = await fetch(
      "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json",
    ).then((r) => r.json());
    echarts.registerMap("china", geoJson);

    if (!chartEl.value) return;
    chart = echarts.init(chartEl.value);
    chart.setOption(initOption());

    // 地图初始化完成后，立即渲染当前已有的数据
    if (props.results.length > 0) {
      chart.setOption({
        series: [{ data: buildProvinceData(props.results, props.ispFilter) }],
      });
    }
  } catch (e) {
    console.error("[PingMap] Failed to init chart:", e);
  }
});

onUnmounted(() => {
  chart?.dispose();
  chart = null;
});

// 监听 results 和 ispFilter 变化，更新地图
watch(
  () => [props.results, props.ispFilter] as const,
  ([results, ispFilter]) => {
    if (!chart) return;
    chart.setOption({
      series: [{ data: buildProvinceData(results, ispFilter) }],
    });
  },
  { deep: true },
);

function onResize() {
  chart?.resize();
}
onMounted(() => window.addEventListener("resize", onResize));
onUnmounted(() => window.removeEventListener("resize", onResize));
</script>

<template>
  <div ref="chartEl" style="width: 450px; height: 400px" />
</template>
