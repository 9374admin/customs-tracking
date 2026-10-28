<template>
  <el-card>
    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <el-select v-model="filterUser" placeholder="Utilizador" clearable filterable style="width: 200px;" @change="loadData">
        <el-option v-for="u in users" :key="u.id" :label="u.display_name" :value="u.id" />
      </el-select>
      <el-select v-model="filterAction" placeholder="Ação" clearable style="width: 180px;" @change="loadData">
        <el-option label="Criar" value="create" />
        <el-option label="Atualizar" value="update" />
        <el-option label="Etapa" value="step_update" />
        <el-option label="Eliminar" value="delete" />
      </el-select>
    </div>
    <el-table :data="data" stripe border v-loading="loading">
      <el-table-column prop="created_at" label="Data/Hora" width="160">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="user_name" label="Utilizador" width="130" />
      <el-table-column prop="user_code" label="Código" width="80" />
      <el-table-column prop="action" label="Ação" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="actionType(row.action)">{{ actionLabel(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="entity_type" label="Entidade" width="100" />
      <el-table-column prop="entity_id" label="ID" width="60" />
      <el-table-column prop="detail" label="Detalhe" />
      <el-table-column label="Valor Anterior" width="120">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #999;">{{ row.old_value }}</span>
        </template>
      </el-table-column>
      <el-table-column label="Novo Valor" width="120">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #67c23a;">{{ row.new_value }}</span>
        </template>
      </el-table-column>
    </el-table>
    <div style="display: flex; justify-content: center; margin-top: 16px;">
      <el-pagination v-model:current-page="page" :page-size="limit" :total="total" layout="prev, pager, next, total" @current-change="loadData" />
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { formatDateTime } from '../assets/constants'

const data = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(100)
const loading = ref(false)
const filterUser = ref('')
const filterAction = ref('')
const users = ref([])

function actionLabel(a) {
  return { create: 'Criar', update: 'Atualizar', step_update: 'Etapa', delete: 'Eliminar' }[a] || a
}

function actionType(a) {
  return { create: 'success', update: 'warning', step_update: 'primary', delete: 'danger' }[a] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const res = await axios.get('/api/logs', { params: { user_id: filterUser.value, action: filterAction.value, page: page.value, limit: limit.value } })
    data.value = res.data.data
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

onMounted(async () => {
  const res = await axios.get('/api/users')
  users.value = res.data
  loadData()
})
</script>