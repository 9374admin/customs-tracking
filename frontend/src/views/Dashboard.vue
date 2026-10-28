<template>
  <div>
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-number">{{ stats.totalProcesses || 0 }}</div>
          <div class="stat-label">Total de Processos</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-number" style="color: #67c23a;">{{ stats.todayCount || 0 }}</div>
          <div class="stat-label">Atualizados Hoje</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-number" style="color: #e6a23c;">{{ inProgressCount }}</div>
          <div class="stat-label">Em Curso</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-number" style="color: #f56c6c;">{{ socketStore.onlineUsers.length }}</div>
          <div class="stat-label">Utilizadores Online</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card header="Progresso por Etapa">
          <v-chart :option="stepChartOption" style="height: 400px;" autoresize />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card header="Processos por Empresa">
          <v-chart :option="empresaChartOption" style="height: 400px;" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 16px;" header="Processos Recentes">
      <el-table :data="stats.recentProcesses || []" stripe size="small">
        <el-table-column prop="seq_no" label="Nº" width="60" />
        <el-table-column prop="empresa" label="Empresa" />
        <el-table-column prop="bl_number" label="Nº BL" />
        <el-table-column prop="updated_by_name" label="Atualizado por" width="140" />
        <el-table-column prop="updated_at" label="Atualizado em" width="160">
          <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="Ação" width="80">
          <template #default="{ row }">
            <el-button size="small" link @click="$router.push(`/processes/${row.id}`)">Ver</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { formatDateTime } from '../assets/constants'

use([CanvasRenderer, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const socketStore = useSocketStore()
const stats = ref({})

const inProgressCount = computed(() => {
  if (!stats.value.stepStats) return 0
  return stats.value.stepStats.reduce((sum, s) => sum + s.em_curso, 0)
})

const stepChartOption = computed(() => {
  const stepStats = stats.value.stepStats || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Concluído', 'Em curso', 'Selecionar'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: stepStats.map(s => s.label), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'Concluído', type: 'bar', stack: 'total', data: stepStats.map(s => s.concluido), itemStyle: { color: '#67c23a' } },
      { name: 'Em curso', type: 'bar', stack: 'total', data: stepStats.map(s => s.em_curso), itemStyle: { color: '#e6a23c' } },
      { name: 'Selecionar', type: 'bar', stack: 'total', data: stepStats.map(s => s.selecionar), itemStyle: { color: '#dcdfe6' } },
    ]
  }
})

const empresaChartOption = computed(() => {
  const data = (stats.value.empresaStats || []).map(e => ({ name: e.empresa, value: e.count }))
  return {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 20, bottom: 20 },
    series: [{ type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'], data, label: { fontSize: 10 } }]
  }
})

async function loadStats() {
  try {
    const res = await axios.get('/api/stats')
    stats.value = res.data
  } catch (e) {}
}

onMounted(() => {
  loadStats()
  socketStore.on('process:updated', loadStats)
  socketStore.on('process:created', loadStats)
  socketStore.on('step:updated', loadStats)
})
</script>