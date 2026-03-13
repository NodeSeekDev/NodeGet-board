<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">
      {{ route.meta.title }}
    </h1>

    <p class="text-muted-foreground text-sm">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const descriptions: Record<string, string> = {
  agents: "添加 / 删除被控，批量更新被控软件版本等，页面开发中...",
  servers: "添加 / 删除主控，切换当前主控，更新主控软件版本等等。页面开发中...",
  loadbalance: "复制 / 移动一部分被控到其他主控，页面开发中...",
  cost: "结合js runtime，做续费管理，页面开发中...",
  cron: "定时ping / 执行 / 告警等任务，页面开发中...",
  scripts: "可以保存脚本片段，便于在终端中使用，页面开发中...",
  "js-runtime": "在主控上内置的js运行时，页面开发中...",
  "app-panel":
    "第三方插件扩展面板，负责插件管理（如安装、卸载、enable/disable），页面开发中...",
  files: "[第三方软件占位符/混合编程] 文件管理器，页面开发中...",
  docker: "[第三方软件占位符/混合编程] docker管理器，页面开发中...",
  process: "[第三方软件占位符/混合编程] 进程管理器，页面开发中...",
  firewall: "[第三方软件占位符/混合编程] 防火墙管理器，页面开发中...",
};

function getDescription(routeName?: string | symbol) {
  if (!routeName || typeof routeName !== "string") {
    return "页面开发中...";
  }

  return descriptions[routeName] ?? "页面开发中...";
}

const description = computed(() => {
  return getDescription(route.name);
});
</script>
