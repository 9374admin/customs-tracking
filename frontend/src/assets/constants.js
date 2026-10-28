export const STEP_NAMES = [
  'licenca_aprovacao', 'du', 'talex', 'transporte', 'nota',
  'legalizacao', 'delivery', 'inspecao', 'detencao',
  'sobrestadia', 'porto', 'terminal', 'entregue'
]

export const STEP_LABELS = {
  licenca_aprovacao: 'Licença/Aprovação',
  du: 'DU',
  talex: 'Talex',
  transporte: 'Transporte',
  nota: 'NOTA',
  legalizacao: 'Legalização',
  delivery: 'Delivery',
  inspecao: 'Inspeção',
  detencao: 'Detenção',
  sobrestadia: 'Sobrestadia',
  porto: 'Porto',
  terminal: 'Terminal',
  entregue: 'Entregue'
}

export const STATUS_OPTIONS = [
  { value: 'selecionar', label: 'Selecionar', type: 'info' },
  { value: 'em_curso', label: 'Em curso', type: 'warning' },
  { value: 'concluido', label: 'Concluído', type: 'success' }
]

export const STATUS_LABELS = {
  selecionar: 'Selecionar',
  em_curso: 'Em curso',
  concluido: 'Concluído'
}

export function statusTagClass(status) {
  return `step-tag-${status}`
}

export function formatDateTime(dt) {
  if (!dt) return ''
  return dt.replace('T', ' ').substring(0, 16)
}