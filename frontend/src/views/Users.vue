<template>
  <el-card>
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
      <h3>Gestão de Utilizadores</h3>
      <el-button type="primary" @click="showCreate = true"><el-icon><Plus/></el-icon> Novo Utilizador</el-button>
    </div>
    <el-table :data="users" stripe border v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="Utilizador" width="140" />
      <el-table-column prop="display_name" label="Nome" width="160" />
      <el-table-column prop="account_code" label="Código" width="100" />
      <el-table-column prop="role" label="Função" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'operator' ? 'warning' : 'info'" size="small">
            {{ roleLabel(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="is_active" label="Ativo" width="80" align="center">
        <template #default="{ row }">
          <el-switch :model-value="!!row.is_active" @change="(val) => toggleActive(row, val)" />
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="Criado em" width="160">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="Ações" width="180">
        <template #default="{ row }">
          <el-button size="small" @click="editUser(row)">Editar</el-button>
          <el-button size="small" @click="resetPassword(row)">Senha</el-button>
          <el-button size="small" type="danger" @click="deleteUser(row)" v-if="row.id !== auth.user?.id">Desativar</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreate" title="Novo Utilizador" width="450px">
      <el-form label-width="120px">
        <el-form-item label="Utilizador"><el-input v-model="createForm.username" /></el-form-item>
        <el-form-item label="Nome"><el-input v-model="createForm.display_name" /></el-form-item>
        <el-form-item label="Código"><el-input v-model="createForm.account_code" /></el-form-item>
        <el-form-item label="Função">
          <el-select v-model="createForm.role" style="width: 100%;">
            <el-option label="Administrador" value="admin" />
            <el-option label="Operador" value="operator" />
            <el-option label="Visualizador" value="viewer" />
          </el-select>
        </el-form-item>
        <el-form-item label="Senha"><el-input v-model="createForm.password" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">Cancelar</el-button>
        <el-button type="primary" @click="createUser" :loading="creating">Criar</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEdit" title="Editar Utilizador" width="450px">
      <el-form label-width="120px">
        <el-form-item label="Nome"><el-input v-model="editForm.display_name" /></el-form-item>
        <el-form-item label="Código"><el-input v-model="editForm.account_code" /></el-form-item>
        <el-form-item label="Função">
          <el-select v-model="editForm.role" style="width: 100%;">
            <el-option label="Administrador" value="admin" />
            <el-option label="Operador" value="operator" />
            <el-option label="Visualizador" value="viewer" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">Cancelar</el-button>
        <el-button type="primary" @click="saveEdit">Guardar</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showReset" title="Redefinir Senha" width="400px">
      <el-form label-width="100px">
        <el-form-item label="Nova Senha"><el-input v-model="resetForm.password" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReset = false">Cancelar</el-button>
        <el-button type="primary" @click="saveReset">Redefinir</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDateTime } from '../assets/constants'

const auth = useAuthStore()
const users = ref([])
const loading = ref(false)
const showCreate = ref(false)
const showEdit = ref(false)
const showReset = ref(false)
const creating = ref(false)
const createForm = ref({ username: '', display_name: '', account_code: '', role: 'operator', password: '' })
const editForm = ref({})
const resetForm = ref({ id: null, password: '' })

function roleLabel(r) {
  return { admin: 'Administrador', operator: 'Operador', viewer: 'Visualizador' }[r] || r
}

async function loadData() {
  loading.value = true
  try {
    const res = await axios.get('/api/users')
    users.value = res.data
  } catch (e) {}
  loading.value = false
}

async function createUser() {
  creating.value = true
  try {
    await axios.post('/api/users', createForm.value)
    ElMessage.success('Utilizador criado')
    showCreate.value = false
    createForm.value = { username: '', display_name: '', account_code: '', role: 'operator', password: '' }
    loadData()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || 'Erro')
  } finally {
    creating.value = false
  }
}

function editUser(row) {
  editForm.value = { ...row }
  showEdit.value = true
}

async function saveEdit() {
  try {
    await axios.put(`/api/users/${editForm.value.id}`, {
      display_name: editForm.value.display_name,
      account_code: editForm.value.account_code,
      role: editForm.value.role
    })
    ElMessage.success('Atualizado')
    showEdit.value = false
    loadData()
  } catch (e) {
    ElMessage.error('Erro')
  }
}

function resetPassword(row) {
  resetForm.value = { id: row.id, password: '' }
  showReset.value = true
}

async function saveReset() {
  try {
    await axios.put(`/api/users/${resetForm.value.id}`, { password: resetForm.value.password })
    ElMessage.success('Senha redefinida')
    showReset.value = false
  } catch (e) {
    ElMessage.error('Erro')
  }
}

async function toggleActive(row, val) {
  try {
    await axios.put(`/api/users/${row.id}`, { is_active: val })
    row.is_active = val ? 1 : 0
  } catch (e) {
    ElMessage.error('Erro')
  }
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`Desativar ${row.display_name}?`, 'Atenção', { type: 'warning' })
    await axios.delete(`/api/users/${row.id}`)
    ElMessage.success('Utilizador desativado')
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>