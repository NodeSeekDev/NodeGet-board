import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
