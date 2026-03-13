import { createRouter, createWebHashHistory } from "vue-router";
import {
  Server,
  Settings,
  Router,
  HardDriveUpload,
  Split,
  Earth,
  CreditCard,
  FileTerminal,
  ListCheck,
  Braces,
  CalendarCheck,
  Box,
  BrickWallFire,
  Package,
  ChartNoAxesGantt,
  LayoutGrid,
  HardDrive,
  FileText,
  Info,
  Key,
  Database,
} from "lucide-vue-next";
import Layout from "@/layout/index.vue";
import RouterViewLayout from "@/layout/components/RouterViewLayout.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("./views/HomeView.vue"),
    },
    {
      path: "/s/:uuid",
      name: "server-detail",
      component: () => import("./views/ServerDetailView.vue"),
    },
    {
      path: "/dashboard",
      component: Layout,
      redirect: "/dashboard/overview",
      children: [
        {
          path: "overview",
          component: () => import("@/views/dashboard/ServersView.vue"),
          meta: { title: "服务概览", icon: Server, order: 1, group: "监控" },
        },
        {
          path: "agents",
          name: "agents",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "被控管理",
            icon: HardDriveUpload,
            order: 2,
            group: "节点管理",
          },
        },
        {
          path: "servers",
          name: "servers",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "主控管理",
            icon: Router,
            order: 3,
            group: "节点管理",
          },
        },
        {
          path: "loadbalance",
          name: "loadbalance",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: { title: "负载调整", icon: Split, order: 4, group: "节点管理" },
        },
        {
          path: "map",
          name: "map",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: { title: "全球地图", icon: Earth, order: 5, group: "节点管理" },
        },
        {
          path: "cron",
          name: "cron",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "定时任务",
            icon: CalendarCheck,
            order: 6,
            group: "工具",
          },
        },
        {
          path: "cost",
          name: "cost",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "成本管理",
            icon: CreditCard,
            order: 7,
            group: "工具",
          },
        },
        {
          path: "scripts",
          name: "scripts",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "脚本片段",
            icon: FileTerminal,
            order: 8,
            group: "工具",
          },
        },
        {
          path: "batch-exec",
          name: "batch-exec",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: { title: "批量执行", icon: ListCheck, order: 9, group: "工具" },
        },
        {
          path: "token",
          name: "token",
          component: () => import("@/views/dashboard/TokenManageView.vue"),
          meta: { title: "Token", icon: Key, order: 9, group: "高级" },
        },
        {
          path: "kv",
          name: "kv",
          component: () => import("@/views/dashboard/KvView.vue"),
          meta: { title: "KV 管理", icon: Database, order: 9, group: "高级" },
        },
        {
          path: "js-runtime",
          name: "js-runtime",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: { title: "JS 扩展", icon: Braces, order: 10, group: "高级" },
        },
        {
          path: "app-panel",
          name: "app-panel",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: { title: "扩展管理", icon: Box, order: 11, group: "应用扩展" },
        },
        {
          path: "app",
          name: "app",
          component: RouterViewLayout,
          redirect: "/dashboard/app/docker",
          meta: {
            title: "应用入口",
            icon: LayoutGrid,
            order: 12,
            group: "应用扩展",
            isClosed: true,
          },
          children: [
            {
              path: "files",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "文件管理", order: 1, icon: HardDrive },
            },
            {
              path: "docker",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "docker管理", order: 2, icon: Package },
            },
            {
              path: "firewall",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "防火墙管理", order: 3, icon: BrickWallFire },
            },
            {
              path: "process",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "进程管理", order: 4, icon: ChartNoAxesGantt },
            },
          ],
        },
        {
          path: "settings",
          name: "settings",
          component: RouterViewLayout,
          redirect: "/dashboard/settings/site",
          meta: {
            title: "设置",
            icon: Settings,
            order: 13,
            group: "系统",
            isClosed: true,
          },
          children: [
            {
              path: "site",
              component: () =>
                import("@/views/dashboard/settings/SiteView.vue"),
              meta: { title: "自定义", order: 1 },
            },
            {
              path: "notification",
              component: () =>
                import("@/views/dashboard/settings/NotificationView.vue"),
              meta: { title: "通知", order: 2 },
            },
          ],
        },
        {
          path: "logs",
          component: () => import("@/views/dashboard/LogsView.vue"),
          meta: { title: "日志", icon: FileText, order: 14, group: "系统" },
        },
        {
          path: "about",
          component: () => import("@/views/dashboard/AboutView.vue"),
          meta: { title: "关于", icon: Info, order: 15, group: "系统" },
        },
        {
          path: "node/:uuid",
          component: () => import("@/views/dashboard/node/NodeLayout.vue"),
          meta: { title: "节点详情", hidden: true },
          redirect: (to) => `/dashboard/node/${to.params.uuid}/ping`,
          children: [
            {
              path: "status",
              name: "status",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "运行状态" },
            },
            {
              path: "ping",
              name: "dashboard-node-ping",
              component: () => import("@/views/dashboard/node/PingView.vue"),
              meta: { title: "Ping 检测" },
            },
            {
              path: "webshell",
              name: "dashboard-node-webshell",
              component: () =>
                import("@/views/dashboard/node/WebShellView.vue"),
              meta: { title: "WebShell 终端" },
            },
            {
              path: "setting",
              name: "dashboard-node-setting",
              component: () => import("@/views/dashboard/node/SettingView.vue"),
              meta: { title: "节点设置" },
            },
            {
              path: "latency",
              name: "latency",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "延迟曲线" },
            },
            {
              path: "traffic",
              name: "traffic",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "流量曲线" },
            },
            {
              path: "update",
              name: "update",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "更新agent" },
            },
            {
              path: "files",
              name: "files",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "文件管理", icon: HardDrive },
            },
            {
              path: "docker",
              name: "docker",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "docker管理", icon: Package },
            },
            {
              path: "firewall",
              name: "firewall",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "防火墙管理", icon: BrickWallFire },
            },
            {
              path: "process",
              name: "process",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "进程管理", icon: ChartNoAxesGantt },
            },
          ],
        },
      ],
    },
  ],
});

export default router;
