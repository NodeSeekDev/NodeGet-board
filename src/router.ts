import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/s/:uuid',
      name: 'server-detail',
      component: () => import('./views/ServerDetailView.vue'),
    },
    {
      path: '/token',
      name: 'token-manage',
      component: () => import('./views/TokenManageView.vue'),
    },
  ],
})

export default router
