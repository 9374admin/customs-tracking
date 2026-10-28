<template>
  <div>
    <el-card>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <el-input v-model="search" placeholder="Buscar por empresa, BL, contentor..." clearable style="width: 300px;" prefix-icon="Search" @input="debouncedSearch" />
          <el-select v-model="filterEmpresa" placeholder="Empresa" clearable filterable style="width: 200px;" @change="loadData">
            <el-option v-for="e in empresas" :key="e" :label="e" :value="e" />
          </el-select>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <span style="font-size: 15px; color: #409eff; font-weight: 700; font-variant-numeric: tabular-nums; padding: 4px 12px; background: #ecf5ff; border-radius: 6px;">
            {{ currentTime }}
          </span>
          <el-button @click="exportExcel" :loading="exporting"><el-icon><Download/></el-icon> Excel</el-button>
          <el-button @click="exportPDF" :loading="exporting"><el-icon><Download/></el-icon> PDF</el-button>
          <el-button type="primary" @click="showCreate = true" v-if="auth.canEdit"><el-icon><Plus/></el-icon> Novo Processo</el-button>
        </div>
      </div>

      <el-table :data="data" stripe border v-loading="loading"
        max-height="calc(100vh - 220px)"
        :row-class-name="rowClassName"
        @cell-dblclick="onCellDblClick">
        <el-table-column prop="seq_no" label="Nº" width="60" fixed />
        <el-table-column prop="empresa" label="Empresa" width="120">
          <template #default="{ row }">
            <el-input v-model="row.empresa" size="small" style="font-size: 11px;" @change="saveField(row, 'empresa')" v-if="auth.canEdit" />
            <span v-else>{{ row.empresa }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bl_number" label="Nº BL" width="130">
          <template #default="{ row }">
            <el-input v-model="row.bl_number" size="small" :style="isBlUrgent(row) ? 'font-size: 11px; color: #f56c6c; font-weight: 700;' : 'font-size: 11px;'" @change="saveField(row, 'bl_number')" v-if="auth.canEdit" />
            <span v-else :style="isBlUrgent(row) ? 'color: #f56c6c; font-weight: 700;' : ''">{{ row.bl_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="container_number" label="Nº Contentor" width="130">
          <template #default="{ row }">
            <el-input v-model="row.container_number" size="small" style="font-size: 11px;" @change="saveField(row, 'container_number')" v-if="auth.canEdit" />
            <span v-else>{{ row.container_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="prevista_date" label="Prevista" width="140">
          <template #default="{ row }">
            <el-date-picker v-model="row.prevista_date" type="date" value-format="YYYY-MM-DD" size="small" style="width: 120px; font-size: 11px;" @change="saveField(row, 'prevista_date')" v-if="auth.canEdit" />
            <span v-else>{{ row.prevista_date }}</span>
          </template>
        </el-table-column>
        <el-table-column v-for="step in STEP_NAMES" :key="step" :label="STEP_LABELS[step]" width="100" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <el-input v-if="step === 'du' && auth.canEdit" v-model="row.du_number" size="small" placeholder="R..." style="width: 80px; font-size: 10px; margin-bottom: 2px;" @change="saveDuNumber(row)" />
              <span v-else-if="step === 'du' && row.du_number" style="font-size: 10px; color: #409eff; font-weight: 600; margin-bottom: 2px;">{{ row.du_number }}</span>
              <el-dropdown trigger="click" @command="(cmd) => updateStepInList(row, step, cmd)" v-if="auth.canEdit">
                <el-tag size="small" :type="getStepTagType(row, step)" style="cursor: pointer; min-width: 56px; text-align: center; display: inline-block;">
                  {{ getStepStatusShort(row, step) }}
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <template v-if="isCustomStep(step)">
                      <el-dropdown-item command="selecionar">Por escolher</el-dropdown-item>
                      <el-dropdown-item command="em_curso">Em candidatura</el-dropdown-item>
                      <el-dropdown-item command="fatura_emitida">Fatura emitida não paga</el-dropdown-item>
                      <el-dropdown-item command="pago">Pago</el-dropdown-item>
                    </template>
                    <template v-else>
                      <el-dropdown-item command="selecionar">Selecionar</el-dropdown-item>
                      <el-dropdown-item command="em_curso">Em curso</el-dropdown-item>
                      <el-dropdown-item command="concluido">Concluído</el-dropdown-item>
                    </template>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag v-else size="small" :type="getStepTagType(row, step)" style="min-width: 56px; text-align: center; display: inline-block;">
                {{ getStepStatusShort(row, step) }}
              </el-tag>
              <div v-if="getStepOperatedCode(row, step)" style="font-size: 8px; margin-top: 2px; line-height: 1.2; white-space: nowrap;">
                <span style="color: #409eff; font-weight: 600;">{{ getStepOperatedCode(row, step) }}</span>
                <span style="color: #c0c4cc;"> {{ getStepOperatedTime(row, step) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Pagamento" width="150" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
              <el-input v-model="row.fee_amount" size="small" placeholder="0.00" style="width: 90px; font-size: 10px;" @change="saveFeeAmount(row)" v-if="auth.canEdit" />
              <span v-else style="font-size: 11px;">{{ row.fee_amount || '-' }}</span>
              <el-select v-model="row.fee_status" size="small" style="width: 95px; font-size: 10px;" @change="saveFeeStatus(row)" v-if="auth.canEdit">
                <el-option label="Por escolher" value="" />
                <el-option label="Em cobrança" value="em_cobranca" />
                <el-option label="Pago" value="pago" />
              </el-select>
              <el-tag v-else size="small" :type="row.fee_status === 'pago' ? 'success' : row.fee_status === 'em_cobranca' ? 'warning' : 'info'">
                {{ { pago: 'Pago', em_cobranca: 'Em cobrança' }[row.fee_status] || 'Por escolher' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="Atualizado" width="140">
          <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: center; margin-top: 16px;">
        <el-pagination v-model:current-page="page" :page-size="limit" :total="total" layout="prev, pager, next, total" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="showCreate" title="Novo Processo" width="500px">
      <el-form label-width="140px">
        <el-form-item label="Empresa"><el-input v-model="createForm.empresa" /></el-form-item>
        <el-form-item label="Nº BL"><el-input v-model="createForm.bl_number" /></el-form-item>
        <el-form-item label="Nº Contentor"><el-input v-model="createForm.container_number" /></el-form-item>
        <el-form-item label="Data Prevista"><el-date-picker v-model="createForm.prevista_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" /></el-form-item>
        <el-form-item label="Nº DU (R...)"><el-input v-model="createForm.du_number" placeholder="R20260012345" /></el-form-item>
        <el-form-item label="Valor Pagamento"><el-input v-model="createForm.fee_amount" placeholder="0.00" /></el-form-item>
        <el-form-item label="Estado Pagamento">
          <el-select v-model="createForm.fee_status" style="width: 100%;">
            <el-option label="Por escolher" value="" />
            <el-option label="Em cobrança" value="em_cobranca" />
            <el-option label="Pago" value="pago" />
          </el-select>
        </el-form-item>
        <el-form-item label="Observações"><el-input v-model="createForm.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">Cancelar</el-button>
        <el-button type="primary" @click="createProcess" :loading="creating">Criar</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { STEP_NAMES, STEP_LABELS, STATUS_LABELS, formatDateTime } from '../assets/constants'

const router = useRouter()
const auth = useAuthStore()
const socketStore = useSocketStore()
const data = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(50)
const search = ref('')
const filterEmpresa = ref('')
const empresas = ref([])
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const exporting = ref(false)
const currentTime = ref('')
let clockTimer = null
const createForm = ref({ empresa: '', bl_number: '', container_number: '', prevista_date: '', fee_status: '', fee_amount: '', du_number: '', notes: '' })

let debounceTimer = null
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadData() }, 300)
}

const CUSTOM_STEPS = ['transporte', 'legalizacao', 'detencao', 'sobrestadia', 'porto', 'terminal']

function isCustomStep(stepName) {
  return CUSTOM_STEPS.includes(stepName)
}

function getStepStatusShort(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  if (isCustomStep(stepName)) {
    return { selecionar: 'Sel.', em_curso: 'Cand.', fatura_emitida: 'Fatura', pago: 'Pago' }[status] || 'Sel.'
  }
  return { selecionar: 'Sel.', em_curso: 'Curso', concluido: 'Conc.' }[status] || 'Sel.'
}

function getStepTagType(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  if (isCustomStep(stepName)) {
    if (status === 'fatura_emitida') return 'danger'
    if (status === 'pago') return 'success'
    return ''
  }
  if (status === 'em_curso') return 'danger'
  if (status === 'concluido') return 'success'
  return ''
}

function getStepOperatedCode(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  return step?.operated_code || ''
}

function getStepOperatedTime(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  if (!step?.operated_at) return ''
  const dt = step.operated_at.replace('T', ' ')
  return dt.substring(5, 16).replace('-', '/')
}

function updateClock() {
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  currentTime.value = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
}

async function updateStepInList(row, stepName, newStatus) {
  const step = row.steps?.find(s => s.step_name === stepName)
  if (!step || step.status === newStatus) return
  const oldStatus = step.status
  step.status = newStatus
  try {
    const res = await axios.put(`/api/processes/${row.id}/steps/${stepName}`, { status: newStatus, note: step.note || '' })
    step.operated_code = res.data.operated_by_code || auth.user?.account_code
    step.operated_at = res.data.operated_at
  } catch (e) {
    step.status = oldStatus
    ElMessage.error('Erro ao atualizar etapa')
  }
}

async function saveField(row, field) {
  try {
    await axios.put(`/api/processes/${row.id}`, { [field]: row[field] || '' })
  } catch (e) {
    ElMessage.error('Erro ao salvar')
  }
}

async function saveDuNumber(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { du_number: row.du_number || '' })
  } catch (e) {
    ElMessage.error('Erro ao salvar Nº DU')
  }
}

function isBlUrgent(row) {
  if (!row.prevista_date) return false
  const prevista = new Date(row.prevista_date)
  const now = new Date()
  const diffDays = (prevista - now) / (1000 * 60 * 60 * 24)
  if (diffDays < 5) {
    const legalStep = row.steps?.find(s => s.step_name === 'legalizacao')
    return !legalStep || legalStep.status === 'selecionar'
  }
  return false
}

function rowClassName({ row }) {
  if (row.fee_status === 'pago') return 'row-pago'
  return ''
}

async function saveFeeAmount(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { fee_amount: row.fee_amount || '' })
  } catch (e) {
    ElMessage.error('Erro ao salvar valor')
  }
}

async function saveFeeStatus(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { fee_status: row.fee_status || '' })
  } catch (e) {
    ElMessage.error('Erro ao salvar estado')
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await axios.get('/api/processes', { params: { search: search.value, empresa: filterEmpresa.value, page: page.value, limit: limit.value } })
    data.value = res.data.data
    total.value = res.data.total
  } catch (e) {
    ElMessage.error('Erro ao carregar dados')
  } finally {
    loading.value = false
  }
}

async function loadEmpresas() {
  try {
    const res = await axios.get('/api/processes/empresas')
    empresas.value = res.data
  } catch (e) {}
}

function onCellDblClick(row, column) {
  if (column.property === 'empresa') {
    router.push(`/processes/${row.id}`)
  }
}

async function createProcess() {
  creating.value = true
  try {
    const res = await axios.post('/api/processes', createForm.value)
    ElMessage.success('Processo criado')
    showCreate.value = false
    createForm.value = { empresa: '', bl_number: '', container_number: '', prevista_date: '', fee_status: '', fee_amount: '', du_number: '', notes: '' }
    router.push(`/processes/${res.data.id}`)
  } catch (e) {
    ElMessage.error('Erro ao criar processo')
  } finally {
    creating.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const res = await axios.get('/api/export/excel', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'processos.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error('Erro ao exportar Excel')
  } finally {
    exporting.value = false
  }
}

async function exportPDF() {
  exporting.value = true
  try {
    const res = await axios.get('/api/export/pdf', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'processos.pdf'
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error('Erro ao exportar PDF')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  loadData()
  loadEmpresas()
  socketStore.on('process:created', loadData)
  socketStore.on('process:updated', loadData)
  socketStore.on('step:updated', loadData)
  socketStore.on('process:deleted', loadData)
})

onUnmounted(() => {
  clearInterval(clockTimer)
  socketStore.off('process:created')
  socketStore.off('process:updated')
  socketStore.off('step:updated')
  socketStore.off('process:deleted')
})
</script>