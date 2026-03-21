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
import { applyPrefetchRoute } from "./utils/prefetchRoute";

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
          meta: {
            title: "router.overview",
            icon: Server,
            order: 1,
            group: "router.group.monitor",
          },
        },
        {
          path: "agents",
          name: "agents",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.agents",
            icon: HardDriveUpload,
            order: 2,
            group: "router.group.nodeManage",
          },
        },
        {
          path: "servers",
          name: "servers",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.servers",
            icon: Router,
            order: 3,
            group: "router.group.nodeManage",
          },
        },
        {
          path: "loadbalance",
          name: "loadbalance",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.loadbalance",
            icon: Split,
            order: 4,
            group: "router.group.nodeManage",
          },
        },
        {
          path: "map",
          name: "map",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.map",
            icon: Earth,
            order: 5,
            group: "router.group.nodeManage",
          },
        },
        {
          path: "cron",
          name: "cron",
          component: () => import("@/views/dashboard/CronView.vue"),
          meta: {
            title: "router.cron",
            icon: CalendarCheck,
            order: 6,
            group: "router.group.tools",
          },
        },
        {
          path: "cron-history/:cronName",
          name: "cron-history",
          component: () => import("@/views/dashboard/CronHistoryView.vue"),
          meta: {
            title: "router.cronHistory",
            hidden: true,
          },
        },
        {
          path: "cost",
          name: "cost",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.cost",
            icon: CreditCard,
            order: 7,
            group: "router.group.tools",
          },
        },
        {
          path: "scripts",
          name: "scripts",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.scripts",
            icon: FileTerminal,
            order: 8,
            group: "router.group.tools",
          },
        },
        {
          path: "batch-exec",
          name: "batch-exec",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.batchExec",
            icon: ListCheck,
            order: 9,
            group: "router.group.tools",
          },
        },
        {
          path: "token",
          name: "token",
          component: () => import("@/views/dashboard/TokenManageView.vue"),
          meta: {
            title: "router.token",
            icon: Key,
            order: 9,
            group: "router.group.advanced",
          },
        },
        {
          path: "kv",
          name: "kv",
          component: () => import("@/views/dashboard/KvView.vue"),
          meta: {
            title: "router.kv",
            icon: Database,
            order: 9,
            group: "router.group.advanced",
          },
        },
        {
          path: "js-runtime",
          name: "js-runtime",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.jsRuntime",
            icon: Braces,
            order: 10,
            group: "router.group.advanced",
          },
        },
        {
          path: "app-panel",
          name: "app-panel",
          component: () => import("@/views/dashboard/WorkInProcessView.vue"),
          meta: {
            title: "router.appPanel",
            icon: Box,
            order: 11,
            group: "router.group.appExtensions",
          },
        },
        {
          path: "app",
          name: "app",
          component: RouterViewLayout,
          redirect: "/dashboard/app/docker",
          meta: {
            title: "router.appEntrance",
            icon: LayoutGrid,
            order: 12,
            group: "router.group.appExtensions",
            isClosed: true,
          },
          children: [
            {
              path: "files",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.files", order: 1, icon: HardDrive },
            },
            {
              path: "docker",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.docker", order: 2, icon: Package },
            },
            {
              path: "firewall",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.firewall", order: 3, icon: BrickWallFire },
            },
            {
              path: "process",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: {
                title: "router.process",
                order: 4,
                icon: ChartNoAxesGantt,
              },
            },
          ],
        },
        {
          path: "settings",
          name: "settings",
          component: RouterViewLayout,
          redirect: "/dashboard/settings/site",
          meta: {
            title: "router.settings",
            icon: Settings,
            order: 13,
            group: "router.group.system",
            isClosed: true,
          },
          children: [
            {
              path: "site",
              component: () =>
                import("@/views/dashboard/settings/SiteView.vue"),
              meta: { title: "router.site", order: 1 },
            },
            {
              path: "notification",
              component: () =>
                import("@/views/dashboard/settings/NotificationView.vue"),
              meta: { title: "router.notification", order: 2 },
            },
          ],
        },
        {
          path: "logs",
          component: () => import("@/views/dashboard/LogsView.vue"),
          meta: {
            title: "router.logs",
            icon: FileText,
            order: 14,
            group: "router.group.system",
          },
        },
        {
          path: "about",
          component: () => import("@/views/dashboard/AboutView.vue"),
          meta: {
            title: "router.about",
            icon: Info,
            order: 15,
            group: "router.group.system",
          },
        },
        {
          path: "node/:uuid",
          component: () => import("@/views/dashboard/node/NodeLayout.vue"),
          meta: { title: "router.node.detail", hidden: true },
          redirect: (to) => `/dashboard/node/${to.params.uuid}/status`,
          children: [
            {
              path: "status",
              name: "status",
              component: () => import("@/views/dashboard/node/StatusView.vue"),
              meta: { title: "router.node.status" },
            },
            {
              path: "ping",
              name: "dashboard-node-ping",
              component: () => import("@/views/dashboard/node/PingView.vue"),
              meta: { title: "router.node.ping" },
            },
            {
              path: "webshell",
              name: "dashboard-node-webshell",
              component: () =>
                import("@/views/dashboard/node/WebShellView.vue"),
              meta: { title: "router.node.webshell" },
            },
            {
              path: "setting",
              name: "dashboard-node-setting",
              component: () => import("@/views/dashboard/node/SettingView.vue"),
              meta: { title: "router.node.setting" },
            },
            {
              path: "latency",
              name: "latency",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.latency" },
            },
            {
              path: "traffic",
              name: "traffic",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.traffic" },
            },
            {
              path: "update",
              name: "update",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.update" },
            },
            {
              path: "files",
              name: "files",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.files", icon: HardDrive },
            },
            {
              path: "docker",
              name: "docker",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.docker", icon: Package },
            },
            {
              path: "firewall",
              name: "firewall",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.firewall", icon: BrickWallFire },
            },
            {
              path: "process",
              name: "process",
              component: () =>
                import("@/views/dashboard/WorkInProcessView.vue"),
              meta: { title: "router.node.process", icon: ChartNoAxesGantt },
            },
          ],
        },
      ],
    },
  ],
});

applyPrefetchRoute(router);

export default router;
