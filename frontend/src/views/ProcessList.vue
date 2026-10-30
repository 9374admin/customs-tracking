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
          <el-button type="danger" @click="batchDelete" v-if="auth.isAdmin" :disabled="selectedRows.length === 0"><el-icon><Delete/></el-icon> Eliminar ({{ selectedRows.length }})</el-button>
        </div>
      </div>

      <el-table :data="data" stripe border v-loading="loading"
        max-height="calc(100vh - 220px)"
        :row-class-name="rowClassName"
        @cell-dblclick="onCellDblClick"
        @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" v-if="auth.isAdmin" />
        <el-table-column prop="seq_no" label="Nº" width="55" sortable>
          <template #default="{ row }">
            <div @dblclick="goToDetail(row)" style="cursor: pointer;">
              <el-input v-model="row.seq_no" size="small" type="number" style="font-size: 13px; width: 50px;" @change="saveField(row, 'seq_no')" v-if="auth.isAdmin" />
              <span v-else>{{ row.seq_no }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="empresa" label="Empresa" width="90">
          <template #default="{ row }">
            <el-input v-model="row.empresa" size="small" style="font-size: 13px;" @change="saveField(row, 'empresa')" v-if="auth.canEdit" />
            <span v-else>{{ row.empresa }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bl_number" label="Nº BL" width="110" fixed="left">
          <template #default="{ row }">
            <el-input v-model="row.bl_number" size="small" :style="isBlUrgent(row) ? 'font-size: 13px; color: #cc0000; font-weight: 700;' : 'font-size: 13px;'" @change="saveField(row, 'bl_number')" v-if="auth.canEdit" />
            <span v-else :style="isBlUrgent(row) ? 'color: #cc0000; font-weight: 700;' : ''">{{ row.bl_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="container_number" label="Nº Contentor" width="100">
          <template #default="{ row }">
            <el-input v-model="row.container_number" size="small" style="font-size: 13px;" @change="saveField(row, 'container_number')" v-if="auth.canEdit" />
            <span v-else>{{ row.container_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="prevista_date" label="Prevista" width="100">
          <template #default="{ row }">
            <el-date-picker v-model="row.prevista_date" type="date" value-format="YYYY-MM-DD" size="small" style="width: 90px; font-size: 12px;" @change="saveField(row, 'prevista_date')" v-if="auth.canEdit" />
            <span v-else>{{ row.prevista_date }}</span>
          </template>
        </el-table-column>
        <el-table-column v-for="step in STEP_NAMES" :key="step" :label="STEP_LABELS[step]" width="85" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <el-input v-if="step === 'du' && auth.canEdit" v-model="row.du_number" size="small" placeholder="R..." style="width: 80px; font-size: 12px; margin-bottom: 2px;" @change="saveDuNumber(row)" />
              <span v-else-if="step === 'du' && row.du_number" style="font-size: 12px; color: #409eff; font-weight: 600; margin-bottom: 2px;">{{ row.du_number }}</span>
              <el-dropdown trigger="click" @command="(cmd) => updateStepInList(row, step, cmd)" v-if="auth.canEdit">
                <el-tag :type="getStepTagType(row, step)" :style="getStepTagStyle(row, step)" style="cursor: pointer; min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
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
              <el-tag v-else :type="getStepTagType(row, step)" :style="getStepTagStyle(row, step)" style="min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
                {{ getStepStatusShort(row, step) }}
              </el-tag>
              <div v-if="getStepOperatedCode(row, step)" style="font-size: 9px; margin-top: 2px; line-height: 1.2; white-space: nowrap;">
                <span style="color: #409eff; font-weight: 600;">{{ getStepOperatedCode(row, step) }}</span>
                <span style="color: #c0c4cc;"> {{ getStepOperatedTime(row, step) }}</span>
              </div>
              <div style="margin-top: 2px; display: flex; gap: 4px; align-items: center;">
                <el-icon :size="13" style="cursor: pointer; color: #409eff;" @click="openFileDialog(row.id, step)"><Paperclip /></el-icon>
                <span v-if="fileCount(row.id, step)" style="font-size: 10px; color: #006400; font-weight: 600; cursor: pointer;" @click="openFileDialog(row.id, step)">{{ fileCount(row.id, step) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Pagamento" width="120" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
              <el-input v-model="row.fee_amount" size="small" placeholder="0.00" style="width: 80px; font-size: 11px;" @change="saveFeeAmount(row)" v-if="auth.canEdit" />
              <span v-else style="font-size: 12px;">{{ row.fee_amount || '-' }}</span>
              <el-select v-model="row.fee_status" size="small" style="width: 85px; font-size: 11px;" @change="saveFeeStatus(row)" v-if="auth.canEdit">
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
        <el-table-column label="Fecho" width="120" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
              <el-select v-model="row.fecho" size="small" style="width: 85px; font-size: 11px;" @change="saveField(row, 'fecho')" v-if="auth.canEdit">
                <el-option label="Aberto" value="" />
                <el-option label="Fechado" value="fechado" />
              </el-select>
              <el-tag v-else size="small" :type="row.fecho === 'fechado' ? 'success' : 'info'">
                {{ row.fecho === 'fechado' ? 'Fechado' : 'Aberto' }}
              </el-tag>
              <div style="margin-top: 2px; display: flex; gap: 4px; align-items: center;">
                <el-icon :size="13" style="cursor: pointer; color: #409eff;" @click="openFileDialog(row.id, 'fecho')"><Paperclip /></el-icon>
                <span v-if="fileCount(row.id, 'fecho')" style="font-size: 10px; color: #006400; font-weight: 600; cursor: pointer;" @click="openFileDialog(row.id, 'fecho')">{{ fileCount(row.id, 'fecho') }}</span>
              </div>
            </div>
          </template>
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
        <el-form-item label="Fecho">
          <el-select v-model="createForm.fecho" style="width: 100%;">
            <el-option label="Aberto" value="" />
            <el-option label="Fechado" value="fechado" />
          </el-select>
        </el-form-item>
        <el-form-item label="Observações"><el-input v-model="createForm.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">Cancelar</el-button>
        <el-button type="primary" @click="createProcess" :loading="creating">Criar</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showFileDialog" :title="`Anexos - ${fileDialogStep}`" width="600px">
      <div style="margin-bottom: 16px;">
        <el-upload
          :show-file-list="false"
          :before-upload="(file) => handleFileUpload(file)"
          :action="''"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip">
          <el-button type="primary" :icon="Upload">Enviar arquivo</el-button>
        </el-upload>
        <span style="margin-left: 12px; font-size: 12px; color: #909399;">Limite: 80MB</span>
      </div>
      <el-table :data="fileList" stripe border v-loading="fileLoading" empty-text="Nenhum arquivo">
        <el-table-column prop="file_name" label="Arquivo" />
        <el-table-column prop="file_size" label="Tamanho" width="100">
          <template #default="{ row }">{{ formatFileSize(row.file_size) }}</template>
        </el-table-column>
        <el-table-column prop="uploaded_at" label="Data" width="140">
          <template #default="{ row }">{{ formatDateTime(row.uploaded_at) }}</template>
        </el-table-column>
        <el-table-column label="Ações" width="120" align="center">
          <template #default="{ row }">
            <el-button size="small" :icon="Download" @click="downloadFile(row)" />
            <el-button size="small" type="danger" :icon="Delete" @click="deleteFile(row)" v-if="auth.canEdit" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Upload, Download, Paperclip } from '@element-plus/icons-vue'
import { STEP_NAMES, STEP_LABELS, STATUS_LABELS, formatDateTime } from '../assets/constants'
import { feedback, successFeedback } from '../utils/feedback'

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

const showFileDialog = ref(false)
const fileDialogProcessId = ref(null)
const fileDialogStep = ref('')
const fileList = ref([])
const fileLoading = ref(false)
const fileCounts = ref({})

const createForm = ref({ empresa: '', bl_number: '', container_number: '', prevista_date: '', fee_status: '', fee_amount: '', du_number: '', fecho: '', notes: '' })

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
    if (status === 'em_curso') return 'warning'
    return ''
  }
  if (status === 'em_curso') return 'warning'
  if (status === 'concluido') return 'success'
  return ''
}

function getStepTagStyle(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  if (stepName === 'detencao' || stepName === 'inspecao') {
    if (status === 'concluido' || status === 'pago') {
      return 'border-width: 2px; border-color: #006400;'
    }
    if (status === 'em_curso' || status === 'fatura_emitida') {
      return 'border-width: 2px; border-color: #cc0000; font-weight: 700;'
    }
  }
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

function goToDetail(row) {
  feedback()
  router.push(`/processes/${row.id}`)
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
    successFeedback()
  } catch (e) {
    step.status = oldStatus
    ElMessage.error('Erro ao atualizar etapa')
  }
}

async function saveField(row, field) {
  try {
    await axios.put(`/api/processes/${row.id}`, { [field]: row[field] || '' })
    feedback()
  } catch (e) {
    ElMessage.error('Erro ao salvar')
  }
}

async function saveDuNumber(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { du_number: row.du_number || '' })
    feedback()
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

function isDetencaoActive(row) {
  const detStep = row.steps?.find(s => s.step_name === 'detencao')
  const insStep = row.steps?.find(s => s.step_name === 'inspecao')
  const detActive = detStep && detStep.status !== 'selecionar' && detStep.status !== 'concluido' && detStep.status !== 'pago'
  const insActive = insStep && insStep.status !== 'selecionar' && insStep.status !== 'concluido' && insStep.status !== 'pago'
  return detActive || insActive
}

function rowClassName({ row }) {
  if (isDetencaoActive(row)) return 'row-detencao-active'
  if (row.fee_status === 'pago') return 'row-pago'
  return ''
}

async function saveFeeAmount(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { fee_amount: row.fee_amount || '' })
    feedback()
  } catch (e) {
    ElMessage.error('Erro ao salvar valor')
  }
}

async function saveFeeStatus(row) {
  try {
    await axios.put(`/api/processes/${row.id}`, { fee_status: row.fee_status || '' })
    feedback()
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
  if (column.property === 'empresa' || column.property === 'seq_no') {
    goToDetail(row)
  }
}

async function createProcess() {
  creating.value = true
  try {
    const res = await axios.post('/api/processes', createForm.value)
    ElMessage.success('Processo criado')
    successFeedback()
    showCreate.value = false
    createForm.value = { empresa: '', bl_number: '', container_number: '', prevista_date: '', fee_status: '', fee_amount: '', du_number: '', fecho: '', notes: '' }
    router.push(`/processes/${res.data.id}`)
  } catch (e) {
    ElMessage.error('Erro ao criar processo')
  } finally {
    creating.value = false
  }
}

async function deleteProcess(row) {
  try {
    await ElMessageBox.confirm(`Eliminar processo ${row.seq_no} - ${row.empresa || ''}?`, 'Atenção', { type: 'warning' })
    await axios.delete(`/api/processes/${row.id}`)
    ElMessage.success('Processo eliminado')
    feedback()
    loadData()
  } catch (e) {}
}

const selectedRows = ref([])
function onSelectionChange(rows) {
  selectedRows.value = rows
}

async function batchDelete() {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`Eliminar ${selectedRows.value.length} processo(s)?`, 'Atenção', { type: 'warning' })
    for (const row of selectedRows.value) {
      await axios.delete(`/api/processes/${row.id}`)
    }
    ElMessage.success(`${selectedRows.value.length} processo(s) eliminado(s)`)
    feedback()
    selectedRows.value = []
    loadData()
  } catch (e) {}
}

function fileCount(processId, stepName) {
  const key = `${processId}_${stepName}`
  return fileCounts.value[key] || 0
}

async function openFileDialog(processId, stepName) {
  feedback()
  fileDialogProcessId.value = processId
  fileDialogStep.value = stepName
  showFileDialog.value = true
  await loadFileList()
}

async function loadFileList() {
  fileLoading.value = true
  try {
    const res = await axios.get(`/api/processes/${fileDialogProcessId.value}/steps/${fileDialogStep.value}/files`)
    fileList.value = res.data
    fileCounts.value[`${fileDialogProcessId.value}_${fileDialogStep.value}`] = res.data.length
  } catch (e) {
    ElMessage.error('Erro ao carregar arquivos')
  } finally {
    fileLoading.value = false
  }
}

async function handleFileUpload(file) {
  const maxSize = 80 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('Arquivo muito grande. Limite: 80MB')
    return false
  }
  const formData = new FormData()
  formData.append('file', file)
  try {
    await axios.post(`/api/processes/${fileDialogProcessId.value}/steps/${fileDialogStep.value}/files`, formData)
    ElMessage.success('Arquivo enviado')
    successFeedback()
    loadFileList()
  } catch (e) {
    ElMessage.error('Erro ao enviar arquivo')
  }
  return false
}

function downloadFile(file) {
  feedback()
  window.open(file.file_url, '_blank')
}

async function deleteFile(file) {
  try {
    await ElMessageBox.confirm(`Eliminar ${file.file_name}?`, 'Atenção', { type: 'warning' })
    await axios.delete(`/api/processes/${fileDialogProcessId.value}/steps/${fileDialogStep.value}/files/${file.id}`)
    ElMessage.success('Arquivo eliminado')
    feedback()
    loadFileList()
  } catch (e) {}
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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