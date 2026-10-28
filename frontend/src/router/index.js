import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../components/Layout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: 'Painel' } },
      { path: 'processes', name: 'ProcessList', component: () => import('../views/ProcessList.vue'), meta: { title: 'Processos' } },
      { path: 'processes/:id', name: 'ProcessDetail', component: () => import('../views/ProcessDetail.vue'), meta: { title: 'Detalhe do Processo' } },
      { path: 'chat', name: 'Chat', component: () => import('../views/Chat.vue'), meta: { title: 'Chat' } },
      { path: 'logs', name: 'Logs', component: () => import('../views/Logs.vue'), meta: { title: 'Registos de Operações' } },
      { path: 'users', name: 'Users', component: () => import('../views/Users.vue'), meta: { title: 'Utilizadores' } },
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.name !== 'Login' && !auth.token) {
    next('/login')
  } else if (to.name === 'Login' && auth.token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router