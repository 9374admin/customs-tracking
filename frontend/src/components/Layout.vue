<template>
  <el-container style="height: 100vh">
    <el-aside :width="sidebarCollapsed ? '0px' : '220px'" style="background: #304156; transition: width 0.3s ease; overflow: hidden;">
      <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 700;">
        Despacho Aduaneiro
      </div>
      <el-menu :default-active="$route.path" router background-color="#304156" text-color="#bfcbd9" active-text-color="#409eff">
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis/></el-icon><span>Painel</span></el-menu-item>
        <el-menu-item index="/processes"><el-icon><Document/></el-icon><span>Processos</span></el-menu-item>
        <el-menu-item index="/chat"><el-icon><ChatDotRound/></el-icon><span>Chat</span></el-menu-item>
        <el-menu-item index="/logs" v-if="auth.isAdmin"><el-icon><List/></el-icon><span>Registos</span></el-menu-item>
        <el-menu-item index="/users" v-if="auth.isAdmin"><el-icon><User/></el-icon><span>Utilizadores</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="background: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <el-icon :size="20" style="cursor: pointer; color: #304156;" @click="sidebarCollapsed = !sidebarCollapsed">
            <Fold v-if="!sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
          <div style="font-size: 18px; font-weight: 600; color: #333;">{{ $route.meta.title || 'Sistema' }}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span class="online-dot"></span>
            <span style="font-size: 13px; color: #666;">{{ socketStore.onlineUsers.length }} online</span>
          </div>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
            <el-icon :size="20" style="cursor: pointer;" @click="showNotifications = !showNotifications"><Bell/></el-icon>
          </el-badge>
          <el-dropdown @command="handleCommand">
            <span style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <el-avatar :size="32" style="background: #409eff;">{{ auth.user?.display_name?.charAt(0) }}</el-avatar>
              <span style="font-size: 14px;">{{ auth.user?.display_name }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">Terminar sessão</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main style="background: #f0f2f5; overflow: auto;">
        <router-view />
      </el-main>
    </el-container>

    <el-drawer v-model="showNotifications" title="Notificações" direction="rtl" size="350px">
      <div v-if="notifications.length === 0" style="text-align: center; color: #999; padding: 40px;">Sem notificações</div>
      <div v-for="n in notifications" :key="n.id" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;" @click="markRead(n)">
        <div style="font-weight: 600; font-size: 14px;">{{ n.title }}</div>
        <div style="font-size: 12px; color: #999; margin-top: 4px;">{{ n.content }}</div>
        <div style="font-size: 11px; color: #ccc; margin-top: 4px;">{{ n.created_at }}</div>
      </div>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'

const router = useRouter()
const auth = useAuthStore()
const socketStore = useSocketStore()
const showNotifications = ref(false)
const notifications = ref([])
const sidebarCollapsed = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.is_read).length)

async function loadNotifications() {
  try {
    const res = await axios.get('/api/chat/notifications')
    notifications.value = res.data
  } catch (e) {}
}

function markRead(n) {
  if (!n.is_read) {
    axios.put(`/api/chat/notifications/${n.id}/read`)
    n.is_read = 1
  }
  if (n.related_id) router.push(`/processes/${n.related_id}`)
}

function handleCommand(cmd) {
  if (cmd === 'logout') {
    socketStore.disconnect()
    auth.logout()
    router.push('/login')
  }
}

onMounted(() => {
  socketStore.connect()
  loadNotifications()
  socketStore.on('notification:new', () => loadNotifications())
  setInterval(loadNotifications, 30000)
})

onUnmounted(() => {
  socketStore.off('notification:new')
})
</script>