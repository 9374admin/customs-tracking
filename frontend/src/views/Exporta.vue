<template>
  <div>
    <div style="background: linear-gradient(135deg, #1a5276, #2874a6); padding: 16px 24px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 3px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">EXPORTA</span>
        <span style="font-size: 14px; color: #aed6f1;">Processo de Exportação</span>
      </div>
      <span style="font-size: 18px; color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; padding: 6px 16px; background: rgba(255,255,255,0.15); border-radius: 8px; backdrop-filter: blur(4px);">
        {{ currentTime }}
      </span>
    </div>

    <el-card style="border-radius: 0 0 8px 8px; margin-top: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <el-input v-model="search" placeholder="Buscar por BL, CNTR, destino..." clearable style="width: 300px;" prefix-icon="Search" @input="debouncedSearch" />
        <div style="display: flex; gap: 12px; align-items: center;">
          <el-button type="primary" @click="showCreate = true" v-if="auth.canEdit"><el-icon><Plus/></el-icon> Novo Processo</el-button>
          <el-button type="danger" @click="batchDelete" v-if="auth.isAdmin" :disabled="selectedRows.length === 0"><el-icon><Delete/></el-icon> Eliminar ({{ selectedRows.length }})</el-button>
        </div>
      </div>

      <el-table :data="data" stripe border v-loading="loading"
        max-height="calc(100vh - 260px)"
        @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" v-if="auth.isAdmin" />
        <el-table-column prop="seq_no" label="Nº" width="50" sortable align="center">
          <template #default="{ row }">
            <span style="font-weight: 700; font-size: 14px;">{{ row.seq_no }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="bl" label="BL" width="120" fixed="left">
          <template #default="{ row }">
            <el-input v-model="row.bl" size="small" style="font-size: 14px; width: 100%;" @change="onFieldChange(row, 'bl')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 14px;">{{ row.bl }}</span>
          </template>
        </el-table-column>

        <el-table-column v-for="col in STEP_COLS" :key="col.key" :label="col.label" :width="col.width || 90" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <el-dropdown trigger="click" @command="(cmd) => updateStep(row, col.key, cmd)" v-if="auth.canEdit">
                <el-tag :type="getTagType(row, col.key)" :style="getTagStyle(row, col.key)" style="cursor: pointer; min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
                  {{ getStepShort(row, col.key) }}
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="selecionar">Por escolher</el-dropdown-item>
                    <el-dropdown-item command="em_curso">Processando</el-dropdown-item>
                    <el-dropdown-item command="concluido">Concluído</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag v-else :type="getTagType(row, col.key)" :style="getTagStyle(row, col.key)" style="min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
                {{ getStepShort(row, col.key) }}
              </el-tag>
              <div v-if="getOperatedCode(row, col.key)" style="font-size: 9px; margin-top: 2px; line-height: 1.2; white-space: nowrap;">
                <span style="color: #409eff; font-weight: 600;">{{ getOperatedCode(row, col.key) }}</span>
                <span style="color: #c0c4cc;"> {{ getOperatedTime(row, col.key) }}</span>
              </div>
              <div style="margin-top: 2px; display: flex; gap: 4px; align-items: center;">
                <el-icon :size="13" style="cursor: pointer; color: #409eff;" @click="openFileDialog(row.id, col.key)"><Paperclip /></el-icon>
                <span v-if="fileCount(row.id, col.key)" style="font-size: 10px; color: #006400; font-weight: 600; cursor: pointer;" @click="openFileDialog(row.id, col.key)">{{ fileCount(row.id, col.key) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="cntr_number" label="Nº de Cntr" width="110">
          <template #default="{ row }">
            <el-input v-model="row.cntr_number" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'cntr_number')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.cntr_number }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="data_vazio" label="Data Vazio" width="110">
          <template #default="{ row }">
            <el-date-picker v-model="row.data_vazio" type="date" value-format="YYYY-MM-DD" format="DD/MM/YYYY" size="small" style="width: 90px; font-size: 12px;" @change="onFieldChange(row, 'data_vazio')" v-if="auth.canEdit" />
            <span v-else style="font-size: 12px;">{{ formatDate(row.data_vazio) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="destino" label="Destino" width="90">
          <template #default="{ row }">
            <el-input v-model="row.destino" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'destino')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.destino }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="navio" label="Navio" width="90">
          <template #default="{ row }">
            <el-input v-model="row.navio" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'navio')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.navio }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="navegador" label="Navegador" width="90">
          <template #default="{ row }">
            <el-input v-model="row.navegador" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'navegador')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.navegador }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="cliente" label="Cliente" width="90">
          <template #default="{ row }">
            <el-input v-model="row.cliente" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'cliente')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.cliente }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="booking_date" label="BOOKING DATE" width="120">
          <template #default="{ row }">
            <el-date-picker v-model="row.booking_date" type="date" value-format="YYYY-MM-DD" format="DD/MM/YYYY" size="small" style="width: 90px; font-size: 12px;" @change="onFieldChange(row, 'booking_date')" v-if="auth.canEdit" />
            <span v-else style="font-size: 12px;">{{ formatDate(row.booking_date) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="terminal" label="Terminal" width="90">
          <template #default="{ row }">
            <el-input v-model="row.terminal" size="small" style="font-size: 12px;" @change="onFieldChange(row, 'terminal')" v-if="auth.canEdit" placeholder="+" />
            <span v-else style="font-size: 12px;">{{ row.terminal }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="fatura" label="Fatura" width="100" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <el-dropdown trigger="click" @command="(cmd) => updateFatura(row, cmd)" v-if="auth.canEdit">
                <el-tag :style="getFaturaStyle(row.fatura)" style="cursor: pointer; min-width: 70px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px; font-weight: 700;">
                  {{ getFaturaLabel(row.fatura) }}
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="">Por escolher</el-dropdown-item>
                    <el-dropdown-item command="nao_pago">Não pago</el-dropdown-item>
                    <el-dropdown-item command="pago">Pago</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag v-else :style="getFaturaStyle(row.fatura)" style="min-width: 70px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px; font-weight: 700;">
                {{ getFaturaLabel(row.fatura) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-for="col in STEP_COLS2" :key="col.key" :label="col.label" :width="col.width || 90" align="center">
          <template #default="{ row }">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <el-dropdown trigger="click" @command="(cmd) => updateStep(row, col.key, cmd)" v-if="auth.canEdit">
                <el-tag :type="getTagType(row, col.key)" :style="getTagStyle(row, col.key)" style="cursor: pointer; min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
                  {{ getStepShort(row, col.key) }}
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="selecionar">Por escolher</el-dropdown-item>
                    <el-dropdown-item command="em_curso">Processando</el-dropdown-item>
                    <el-dropdown-item command="concluido">Concluído</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tag v-else :type="getTagType(row, col.key)" :style="getTagStyle(row, col.key)" style="min-width: 64px; text-align: center; display: inline-block; font-size: 12px; padding: 3px 6px;">
                {{ getStepShort(row, col.key) }}
              </el-tag>
              <div v-if="getOperatedCode(row, col.key)" style="font-size: 9px; margin-top: 2px; line-height: 1.2; white-space: nowrap;">
                <span style="color: #409eff; font-weight: 600;">{{ getOperatedCode(row, col.key) }}</span>
                <span style="color: #c0c4cc;"> {{ getOperatedTime(row, col.key) }}</span>
              </div>
              <div style="margin-top: 2px; display: flex; gap: 4px; align-items: center;">
                <el-icon :size="13" style="cursor: pointer; color: #409eff;" @click="openFileDialog(row.id, col.key)"><Paperclip /></el-icon>
                <span v-if="fileCount(row.id, col.key)" style="font-size: 10px; color: #006400; font-weight: 600; cursor: pointer;" @click="openFileDialog(row.id, col.key)">{{ fileCount(row.id, col.key) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: center; margin-top: 16px;">
        <el-pagination v-model:current-page="page" :page-size="limit" :total="total" layout="prev, pager, next, total" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="showCreate" title="Novo Processo de Exportação" width="500px">
      <el-form label-width="140px">
        <el-form-item label="BL"><el-input v-model="createForm.bl" /></el-form-item>
        <el-form-item label="Nº de CNTR"><el-input v-model="createForm.cntr_number" /></el-form-item>
        <el-form-item label="Data Vazio"><el-date-picker v-model="createForm.data_vazio" type="date" value-format="YYYY-MM-DD" format="DD/MM/YYYY" style="width: 100%;" /></el-form-item>
        <el-form-item label="Destino"><el-input v-model="createForm.destino" /></el-form-item>
        <el-form-item label="Navio"><el-input v-model="createForm.navio" /></el-form-item>
        <el-form-item label="Navegador"><el-input v-model="createForm.navegador" /></el-form-item>
        <el-form-item label="Cliente"><el-input v-model="createForm.cliente" /></el-form-item>
        <el-form-item label="Booking Date"><el-date-picker v-model="createForm.booking_date" type="date" value-format="YYYY-MM-DD" format="DD/MM/YYYY" style="width: 100%;" /></el-form-item>
        <el-form-item label="Terminal"><el-input v-model="createForm.terminal" /></el-form-item>
        <el-form-item label="Fatura">
          <el-select v-model="createForm.fatura" style="width: 100%;">
            <el-option label="Por escolher" value="" />
            <el-option label="Não pago" value="nao_pago" />
            <el-option label="Pago" value="pago" />
          </el-select>
        </el-form-item>
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
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Upload, Download, Paperclip, Plus } from '@element-plus/icons-vue'
import { formatDateTime } from '../assets/constants'
import { feedback, successFeedback } from '../utils/feedback'

const auth = useAuthStore()
const socketStore = useSocketStore()
const data = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(50)
const search = ref('')
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const currentTime = ref('')
let clockTimer = null

const STEP_COLS = [
  { key: 'booking', label: 'BOOKING' },
  { key: 'ctt', label: 'CTT' },
]
const STEP_COLS2 = [
  { key: 'draft', label: 'Draft' },
  { key: 'vgm', label: 'VGM' },
  { key: 'draft_final', label: 'Draft Final' },
  { key: 'partida', label: 'Partida' },
  { key: 'chegado', label: 'Chegado' },
  { key: 'estado_ctt', label: 'Estado CTT' },
  { key: 'estado_selo', label: 'Estado Selo' },
  { key: 'entrada_terminal', label: 'Entrada Terminal' },
  { key: 'frete', label: 'FRETE' },
  { key: 'fecho', label: 'FECHO' },
]

const showFileDialog = ref(false)
const fileDialogProcessId = ref(null)
const fileDialogStep = ref('')
const fileList = ref([])
const fileLoading = ref(false)
const fileCounts = ref({})

const createForm = ref({ bl: '', cntr_number: '', data_vazio: '', destino: '', navio: '', navegador: '', cliente: '', booking_date: '', terminal: '', fatura: '' })

let debounceTimer = null
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadData() }, 300)
}

function updateClock() {
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  currentTime.value = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
}

function getStepShort(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  return { selecionar: 'Sel.', em_curso: 'Proc.', concluido: 'Conc.' }[status] || 'Sel.'
}

function getTagType(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  if (status === 'em_curso') return 'warning'
  if (status === 'concluido') return 'success'
  return ''
}

function getTagStyle(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  const status = step?.status || 'selecionar'
  if (status === 'em_curso') return 'background: #fff8cc; color: #e6a200; border-color: #ffcc00; font-weight: 700;'
  if (status === 'concluido') return 'background: #c8efd0; color: #006400; border-color: #006400; font-weight: 700;'
  return ''
}

function getOperatedCode(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  return step?.operated_by_name || ''
}

function getOperatedTime(row, stepName) {
  const step = row.steps?.find(s => s.step_name === stepName)
  if (!step?.operated_at) return ''
  const dt = step.operated_at.replace('T', ' ')
  return dt.substring(5, 16).replace('-', '/')
}

function getFaturaLabel(fatura) {
  return { '': 'Por escolher', nao_pago: 'Não pago', pago: 'Pago' }[fatura] || 'Por escolher'
}

function getFaturaStyle(fatura) {
  if (fatura === 'nao_pago') return 'background: #cc0000; color: #fff; border-color: #cc0000; font-weight: 700; border-width: 2px;'
  if (fatura === 'pago') return 'background: #006400; color: #fff; border-color: #006400; font-weight: 700; border-width: 2px;'
  return 'background: #f4f4f5; color: #909399; border-color: #dcdfe6;'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

const syncQueue = []
let syncTimer = null
let syncing = false

function queueSync(type, d) {
  syncQueue.push({ type, data: d, retries: 0 })
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(flushSync, 10000)
}

async function flushSync() {
  if (syncing || syncQueue.length === 0) return
  syncing = true
  while (syncQueue.length > 0) {
    const item = syncQueue.shift()
    try {
      if (item.type === 'step') {
        await axios.put(`/api/exporta/${item.data.processId}/step/${item.data.stepName}`, { status: item.data.status })
      } else if (item.type === 'field') {
        await axios.put(`/api/exporta/${item.data.processId}`, { [item.data.field]: item.data.value })
      }
    } catch (e) {
      if (item.retries < 3) { item.retries++; syncQueue.push(item) }
    }
  }
  syncing = false
}

function updateStep(row, stepName, newStatus) {
  const step = row.steps?.find(s => s.step_name === stepName)
  if (!step || step.status === newStatus) return
  step.status = newStatus
  step.operated_by_name = auth.user?.display_name || ''
  step.operated_at = new Date().toISOString().replace('T', ' ').substring(0, 19)
  successFeedback()
  queueSync('step', { processId: row.id, stepName, status: newStatus })
}

function updateFatura(row, newStatus) {
  if (row.fatura === newStatus) return
  row.fatura = newStatus
  successFeedback()
  queueSync('field', { processId: row.id, field: 'fatura', value: newStatus })
}

function saveField(row, field) {
  feedback()
  queueSync('field', { processId: row.id, field, value: row[field] || '' })
}

function getEmptyRow() {
  return { id: 0, seq_no: '*', bl: '', cntr_number: '', data_vazio: '', destino: '', navio: '', navegador: '', cliente: '', booking_date: '', terminal: '', fatura: '', notes: '', steps: [], isNew: true }
}

async function onFieldChange(row, field) {
  if (row.isNew) {
    const val = row[field]
    if (!val || val === '') return
    try {
      const res = await axios.post('/api/exporta', { [field]: val })
      Object.assign(row, res.data)
      row.isNew = false
      data.value.push(getEmptyRow())
      successFeedback()
      ElMessage.success('Processo criado')
    } catch (e) {
      ElMessage.error('Erro ao criar processo')
    }
  } else {
    saveField(row, field)
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await axios.get('/api/exporta', { params: { search: search.value, page: page.value, limit: limit.value } })
    data.value = res.data.data
    if (auth.canEdit && page.value === 1) data.value.push(getEmptyRow())
    total.value = res.data.total
  } catch (e) {
    ElMessage.error('Erro ao carregar dados')
  } finally {
    loading.value = false
  }
}

async function createProcess() {
  creating.value = true
  try {
    await axios.post('/api/exporta', createForm.value)
    ElMessage.success('Processo criado')
    successFeedback()
    showCreate.value = false
    createForm.value = { bl: '', cntr_number: '', data_vazio: '', destino: '', navio: '', navegador: '', cliente: '', booking_date: '', terminal: '', fatura: '' }
    loadData()
  } catch (e) {
    ElMessage.error('Erro ao criar processo')
  } finally {
    creating.value = false
  }
}

const selectedRows = ref([])
function onSelectionChange(rows) { selectedRows.value = rows }

async function batchDelete() {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`Eliminar ${selectedRows.value.length} processo(s)?`, 'Atenção', { type: 'warning' })
    await axios.delete('/api/exporta', { data: { ids: selectedRows.value.map(r => r.id) } })
    ElMessage.success(`${selectedRows.value.length} processo(s) eliminado(s)`)
    feedback()
    selectedRows.value = []
    loadData()
  } catch (e) {}
}

function fileCount(processId, stepName) {
  return fileCounts.value[`${processId}_${stepName}`] || 0
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
    const res = await axios.get(`/api/exporta/${fileDialogProcessId.value}/files/${fileDialogStep.value}`)
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
  if (file.size > maxSize) { ElMessage.error('Arquivo muito grande. Limite: 80MB'); return false }
  const formData = new FormData()
  formData.append('file', file)
  try {
    await axios.post(`/api/exporta/${fileDialogProcessId.value}/files/${fileDialogStep.value}`, formData)
    ElMessage.success('Arquivo enviado')
    successFeedback()
    loadFileList()
  } catch (e) {
    ElMessage.error('Erro ao enviar arquivo')
  }
  return false
}

function downloadFile(file) { feedback(); window.open(file.file_url, '_blank') }

async function deleteFile(file) {
  try {
    await ElMessageBox.confirm(`Eliminar ${file.file_name}?`, 'Atenção', { type: 'warning' })
    await axios.delete(`/api/exporta/files/${file.id}`)
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

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  loadData()
  window.addEventListener('beforeunload', flushSync)
})

onUnmounted(() => {
  clearInterval(clockTimer)
  window.removeEventListener('beforeunload', flushSync)
  flushSync()
})
</script>