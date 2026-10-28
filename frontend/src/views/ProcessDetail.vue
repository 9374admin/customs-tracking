<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push('/processes')" :title="'Voltar'" style="margin-bottom: 16px;">
      <template #content>
        <span style="font-size: 18px; font-weight: 600;">Processo #{{ process?.seq_no }} - {{ process?.empresa }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card header="Informação Geral">
          <el-form label-width="120px" size="small">
            <el-form-item label="Nº"><span>{{ process?.seq_no }}</span></el-form-item>
            <el-form-item label="Empresa">
              <el-input v-model="editForm.empresa" @change="saveField('empresa')" v-if="auth.canEdit" />
              <span v-else>{{ process?.empresa }}</span>
            </el-form-item>
            <el-form-item label="Nº BL">
              <el-input v-model="editForm.bl_number" @change="saveField('bl_number')" v-if="auth.canEdit" />
              <span v-else>{{ process?.bl_number }}</span>
            </el-form-item>
            <el-form-item label="Nº Contentor">
              <el-input v-model="editForm.container_number" @change="saveField('container_number')" v-if="auth.canEdit" />
              <span v-else>{{ process?.container_number }}</span>
            </el-form-item>
            <el-form-item label="Data Prevista">
              <el-date-picker v-model="editForm.prevista_date" type="datetime" value-format="YYYY-MM-DD HH:mm" style="width: 100%;" @change="saveField('prevista_date')" v-if="auth.canEdit" />
              <span v-else>{{ formatDateTime(process?.prevista_date) }}</span>
            </el-form-item>
            <el-form-item label="Pagamento">
              <el-input v-model="editForm.fee_status" @change="saveField('fee_status')" v-if="auth.canEdit" />
              <span v-else>{{ process?.fee_status }}</span>
            </el-form-item>
            <el-form-item label="Observações">
              <el-input v-model="editForm.notes" type="textarea" @change="saveField('notes')" v-if="auth.canEdit" />
              <span v-else>{{ process?.notes }}</span>
            </el-form-item>
          </el-form>
          <div style="font-size: 11px; color: #ccc; margin-top: 8px;">
            Criado por: {{ process?.created_by_name }} em {{ formatDateTime(process?.created_at) }}
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Etapas do Processo</span>
              <div>
                <span v-for="v in viewers" :key="v.id" style="font-size: 11px; color: #409eff; margin-right: 8px;">
                  <el-icon><View/></el-icon> {{ v.displayName }}
                </span>
              </div>
            </div>
          </template>
          <el-table :data="process?.steps || []" border size="small">
            <el-table-column label="Etapa" width="160">
              <template #default="{ row }">
                <span style="font-weight: 600;">{{ STEP_LABELS[row.step_name] }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Estado" width="360" align="center">
              <template #default="{ row }">
                <el-button-group v-if="isCustomStep(row.step_name)">
                  <el-button size="small" plain
                    @click="setStepStatus(row, 'selecionar')"
                    :disabled="!auth.canEdit">Escolher</el-button>
                  <el-button size="small" plain
                    @click="setStepStatus(row, 'em_curso')"
                    :disabled="!auth.canEdit">Candidatura</el-button>
                  <el-button size="small"
                    :type="row.status === 'fatura_emitida' ? 'danger' : 'info'"
                    :plain="row.status !== 'fatura_emitida'"
                    @click="setStepStatus(row, 'fatura_emitida')"
                    :disabled="!auth.canEdit">Fatura não paga</el-button>
                  <el-button size="small"
                    :type="row.status === 'pago' ? 'success' : 'info'"
                    :plain="row.status !== 'pago'"
                    @click="setStepStatus(row, 'pago')"
                    :disabled="!auth.canEdit">Pago</el-button>
                </el-button-group>
                <el-button-group v-else>
                  <el-button size="small" plain
                    @click="setStepStatus(row, 'selecionar')"
                    :disabled="!auth.canEdit">Selecionar</el-button>
                  <el-button size="small"
                    :type="row.status === 'em_curso' ? 'danger' : 'info'"
                    :plain="row.status !== 'em_curso'"
                    @click="setStepStatus(row, 'em_curso')"
                    :disabled="!auth.canEdit">Em curso</el-button>
                  <el-button size="small"
                    :type="row.status === 'concluido' ? 'success' : 'info'"
                    :plain="row.status !== 'concluido'"
                    @click="setStepStatus(row, 'concluido')"
                    :disabled="!auth.canEdit">Concluído</el-button>
                </el-button-group>
              </template>
            </el-table-column>
            <el-table-column label="Operado por" width="140">
              <template #default="{ row }">
                <div v-if="row.operated_by_name" class="step-operated-info">
                  {{ row.operated_by_name }} ({{ row.operated_by_code }})
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Operado em" width="150">
              <template #default="{ row }">
                <div v-if="row.operated_at" class="step-operated-info">{{ formatDateTime(row.operated_at) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="Nota">
              <template #default="{ row }">
                <el-input v-model="row.note" size="small" placeholder="Nota..." @change="updateStepNote(row)" :disabled="!auth.canEdit" />
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; display: flex; justify-content: space-between;">
            <div>
              <el-progress :percentage="progressPercent" :format="() => `${completedCount}/${STEP_NAMES.length} concluídas`" />
            </div>
            <el-button type="danger" @click="deleteProcess" v-if="auth.isAdmin" size="small">Eliminar Processo</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { STEP_NAMES, STEP_LABELS, STATUS_OPTIONS, formatDateTime } from '../assets/constants'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const socketStore = useSocketStore()
const process = ref(null)
const editForm = ref({})
const loading = ref(true)
const viewers = ref([])
const processId = computed(() => parseInt(route.params.id))

const completedCount = computed(() => process.value?.steps?.filter(s => s.status === 'concluido').length || 0)
const progressPercent = computed(() => Math.round((completedCount.value / STEP_NAMES.length) * 100))

async function loadData() {
  loading.value = true
  try {
    const res = await axios.get(`/api/processes/${processId.value}`)
    process.value = res.data
    editForm.value = {
      empresa: res.data.empresa, bl_number: res.data.bl_number,
      container_number: res.data.container_number, prevista_date: res.data.prevista_date,
      fee_status: res.data.fee_status, notes: res.data.notes
    }
  } catch (e) {
    ElMessage.error('Processo não encontrado')
    router.push('/processes')
  } finally {
    loading.value = false
  }
}

async function saveField(field) {
  try {
    await axios.put(`/api/processes/${processId.value}`, { [field]: editForm.value[field] })
    ElMessage.success('Atualizado')
  } catch (e) {
    ElMessage.error('Erro ao atualizar')
  }
}

const CUSTOM_STEPS = ['transporte', 'legalizacao', 'detencao', 'sobrestadia', 'porto', 'terminal']
function isCustomStep(stepName) {
  return CUSTOM_STEPS.includes(stepName)
}

async function setStepStatus(step, newStatus) {
  if (step.status === newStatus) return
  step.status = newStatus
  await updateStep(step)
}

async function updateStep(step) {
  try {
    await axios.put(`/api/processes/${processId.value}/steps/${step.step_name}`, { status: step.status, note: step.note })
    ElMessage.success(`${STEP_LABELS[step.step_name]}: ${step.status}`)
  } catch (e) {
    ElMessage.error('Erro ao atualizar etapa')
    loadData()
  }
}

async function updateStepNote(step) {
  try {
    await axios.put(`/api/processes/${processId.value}/steps/${step.step_name}`, { status: step.status, note: step.note })
  } catch (e) {
    ElMessage.error('Erro ao salvar nota')
  }
}

async function deleteProcess() {
  try {
    await ElMessageBox.confirm('Confirma a eliminação deste processo?', 'Atenção', { type: 'warning' })
    await axios.delete(`/api/processes/${processId.value}`)
    ElMessage.success('Processo eliminado')
    router.push('/processes')
  } catch (e) {}
}

function onStepUpdated(data) {
  if (data.processId !== processId.value) return
  const idx = process.value?.steps?.findIndex(s => s.step_name === data.step.step_name)
  if (idx !== undefined && idx >= 0) {
    process.value.steps[idx] = data.step
  }
}

function onProcessUpdated(updated) {
  if (updated.id !== processId.value) return
  process.value = updated
  editForm.value = {
    empresa: updated.empresa, bl_number: updated.bl_number,
    container_number: updated.container_number, prevista_date: updated.prevista_date,
    fee_status: updated.fee_status, notes: updated.notes
  }
}

onMounted(() => {
  loadData()
  socketStore.emit('process:viewing', processId.value)
  socketStore.on('step:updated', onStepUpdated)
  socketStore.on('process:updated', onProcessUpdated)
  socketStore.on('process:viewers', (data) => {
    if (data.processId === processId.value) viewers.value = data.viewers
  })
})

onUnmounted(() => {
  socketStore.emit('process:leave', processId.value)
  socketStore.off('step:updated', onStepUpdated)
  socketStore.off('process:updated', onProcessUpdated)
})

watch(processId, loadData)
</script>