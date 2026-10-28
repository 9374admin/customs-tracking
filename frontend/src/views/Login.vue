<template>
  <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <el-card style="width: 400px; border-radius: 12px;" body-style="padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 8px;">Sistema de Despacho Aduaneiro</h2>
        <p style="color: #999; font-size: 14px;">Acompanhamento de Processos</p>
      </div>
      <el-form @submit.prevent="handleLogin" label-position="top">
        <el-form-item label="Utilizador">
          <el-input v-model="form.username" prefix-icon="User" size="large" placeholder="Utilizador" />
        </el-form-item>
        <el-form-item label="Palavra-passe">
          <el-input v-model="form.password" prefix-icon="Lock" size="large" type="password" show-password placeholder="Palavra-passe" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%; margin-top: 10px;" :loading="loading" @click="handleLogin">Entrar</el-button>
      </el-form>
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #ccc;">
        Utilizador padrão: admin / admin123
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import { ElMessage } from 'element-plus'

const router = useRouter()
const auth = useAuthStore()
const socketStore = useSocketStore()
const form = ref({ username: '', password: '' })
const loading = ref(false)

async function handleLogin() {
  if (!form.value.username || !form.value.password) return
  loading.value = true
  try {
    await auth.login(form.value.username, form.value.password)
    socketStore.connect()
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || 'Erro ao entrar')
  } finally {
    loading.value = false
  }
}
</script>