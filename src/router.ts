import { createRouter, createWebHashHistory } from "vue-router";
import {
  Server,
  Settings,
  Terminal,
  Activity,
  Users,
  User,
  FileText,
  Info,
  Key,
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
      redirect: "/dashboard/servers",
      children: [
        {
          path: "servers",
          component: () => import("@/views/dashboard/ServersView.vue"),
          meta: { title: "服务器", icon: Server, order: 1, group: "监控" },
        },
        {
          path: "latency",
          component: () => import("@/views/dashboard/LatencyView.vue"),
          meta: { title: "延迟检测", icon: Activity, order: 2, group: "监控" },
        },
        {
          path: "exec",
          component: () => import("@/views/dashboard/ExecView.vue"),
          meta: { title: "远程执行", icon: Terminal, order: 1, group: "工具" },
        },
        {
          path: "sessions",
          component: () => import("@/views/dashboard/SessionsView.vue"),
          meta: { title: "会话管理", icon: Users, order: 2, group: "工具" },
        },
        {
          path: "settings",
          component: RouterViewLayout,
          redirect: "/dashboard/settings/site",
          meta: { title: "设置", icon: Settings, order: 1, group: "系统" },
          children: [
            {
              path: "site",
              component: () =>
                import("@/views/dashboard/settings/SiteView.vue"),
              meta: { title: "站点", order: 1 },
            },
            {
              path: "login",
              component: () =>
                import("@/views/dashboard/settings/LoginView.vue"),
              meta: { title: "登录", order: 2 },
            },
            {
              path: "notification",
              component: () =>
                import("@/views/dashboard/settings/NotificationView.vue"),
              meta: { title: "通知", order: 3 },
            },
            {
              path: "general",
              component: () =>
                import("@/views/dashboard/settings/GeneralView.vue"),
              meta: { title: "通用", order: 4 },
            },
          ],
        },
        {
          path: "token",
          component: () => import("@/views/dashboard/TokenManageView.vue"),
          meta: { title: "Token", icon: Key, order: 2, group: "系统" },
        },
        {
          path: "logs",
          component: () => import("@/views/dashboard/LogsView.vue"),
          meta: { title: "日志", icon: FileText, order: 3, group: "系统" },
        },
        {
          path: "account",
          component: () => import("@/views/dashboard/AccountView.vue"),
          meta: { title: "账户", icon: User, order: 4, group: "系统" },
        },
        {
          path: "about",
          component: () => import("@/views/dashboard/AboutView.vue"),
          meta: { title: "关于", icon: Info, order: 5, group: "系统" },
        },
      ],
    },
  ],
});

export default router;
