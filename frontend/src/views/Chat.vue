<template>
  <div style="height: calc(100vh - 120px); display: flex; gap: 16px;">
    <el-card style="width: 220px; flex-shrink: 0; overflow: auto;">
      <template #header><span>Online ({{ socketStore.onlineUsers.length }})</span></template>
      <div v-for="u in socketStore.onlineUsers" :key="u.id" style="display: flex; align-items: center; padding: 6px 0;">
        <span class="online-dot"></span>
        <span style="font-size: 13px;">{{ u.displayName }}</span>
        <span style="font-size: 10px; color: #ccc; margin-left: 4px;">({{ u.accountCode }})</span>
      </div>
      <div v-if="socketStore.onlineUsers.length === 0" style="color: #ccc; text-align: center; padding: 20px;">Ninguém online</div>
    </el-card>

    <el-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden;" body-style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
      <div style="padding: 12px 16px; border-bottom: 1px solid #eee; font-weight: 600;">
        Chat Geral
        <span v-if="typingUsers.length" style="font-size: 11px; color: #999; margin-left: 12px; font-weight: normal;">
          {{ typingUsers.join(', ') }} a escrever...
        </span>
      </div>

      <div ref="messagesContainer" style="flex: 1; overflow-y: auto; padding: 16px;">
        <div v-for="msg in messages" :key="msg.id" :class="['chat-message', msg.sender_id === auth.user?.id ? 'chat-message-self' : 'chat-message-other']">
          <div v-if="msg.sender_id !== auth.user?.id" style="font-size: 12px; color: #666; margin-bottom: 2px;">
            {{ msg.sender_name }} ({{ msg.sender_code }})
          </div>
          <div :class="['chat-bubble', msg.sender_id === auth.user?.id ? 'chat-bubble-self' : 'chat-bubble-other']">
            <div v-if="msg.file_url" style="margin-bottom: 4px;">
              <a :href="msg.file_url" :download="msg.file_name" target="_blank" style="color: inherit; text-decoration: underline;">
                <el-icon><Paperclip/></el-icon> {{ msg.file_name }} ({{ formatFileSize(msg.file_size) }})
              </a>
            </div>
            <div v-html="renderContent(msg.content)"></div>
          </div>
          <div class="chat-meta">{{ formatDateTime(msg.created_at) }}</div>
        </div>
      </div>

      <div style="padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px; align-items: flex-end;">
        <el-upload :show-file-list="false" :before-upload="handleFileUpload" :action="''">
          <el-button :icon="Paperclip" circle />
        </el-upload>
        <div style="flex: 1; position: relative;">
          <el-input v-model="inputText" type="textarea" :rows="2" placeholder="Escreva uma mensagem... Use @ para mencionar" @input="onInput" @keydown.enter.exact.prevent="sendMessage" />
          <div v-if="showMentions" style="position: absolute; bottom: 100%; left: 0; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10; max-height: 200px; overflow: auto; width: 200px;">
            <div v-for="u in mentionList" :key="u.id" @click="selectMention(u)" style="padding: 8px 12px; cursor: pointer; font-size: 13px;" @mouseover="$event.target.style.background='#f5f7fa'" @mouseout="$event.target.style.background=''">
              {{ u.displayName }} ({{ u.accountCode }})
            </div>
          </div>
        </div>
        <el-button type="primary" @click="sendMessage" :disabled="!inputText.trim()">Enviar</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSocketStore } from '../stores/socket'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Paperclip } from '@element-plus/icons-vue'
import { formatDateTime } from '../assets/constants'

const auth = useAuthStore()
const socketStore = useSocketStore()
const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const typingUsers = ref([])
const showMentions = ref(false)
const mentionedIds = ref([])
let typingTimer = null

const mentionList = computed(() => {
  const atIdx = inputText.value.lastIndexOf('@')
  if (atIdx === -1) return []
  return socketStore.onlineUsers.filter(u =>
    u.displayName.toLowerCase().includes(inputText.value.substring(atIdx + 1).toLowerCase())
  )
})

watch(() => inputText.value, (val) => {
  showMentions.value = val.includes('@') && mentionList.value.length > 0
})

function selectMention(user) {
  const atIdx = inputText.value.lastIndexOf('@')
  inputText.value = inputText.value.substring(0, atIdx) + `@${user.displayName} `
  mentionedIds.value.push(user.id)
  showMentions.value = false
}

function renderContent(content) {
  return content.replace(/@(\S+)/g, '<span class="mention-highlight">@$1</span>')
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function loadMessages() {
  try {
    const res = await axios.get('/api/chat/messages')
    messages.value = res.data
    nextTick(scrollToBottom)
  } catch (e) {}
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  if (!inputText.value.trim()) return
  try {
    await axios.post('/api/chat/messages', {
      content: inputText.value,
      mentioned_users: JSON.stringify(mentionedIds.value)
    })
    inputText.value = ''
    mentionedIds.value = []
    socketStore.emit('chat:stop-typing')
  } catch (e) {
    ElMessage.error('Erro ao enviar mensagem')
  }
}

function handleFileUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('content', '')
  axios.post('/api/chat/messages', formData).then(() => {
    ElMessage.success('Arquivo enviado')
  }).catch(() => {
    ElMessage.error('Erro ao enviar arquivo')
  })
  return false
}

function onInput() {
  socketStore.emit('chat:typing', {})
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => socketStore.emit('chat:stop-typing'), 2000)
}

function onChatMessage(msg) {
  messages.value.push(msg)
  nextTick(scrollToBottom)
}

function onTyping(data) {
  if (data.userId === auth.user?.id) return
  if (!typingUsers.value.includes(data.displayName)) {
    typingUsers.value.push(data.displayName)
  }
}

function onStopTyping(data) {
  typingUsers.value = typingUsers.value.filter(u => u !== socketStore.onlineUsers.find(o => o.id === data.userId)?.displayName)
}

onMounted(() => {
  loadMessages()
  socketStore.on('chat:message', onChatMessage)
  socketStore.on('chat:typing', onTyping)
  socketStore.on('chat:stop-typing', onStopTyping)
})

onUnmounted(() => {
  socketStore.off('chat:message', onChatMessage)
  socketStore.off('chat:typing', onTyping)
  socketStore.off('chat:stop-typing', onStopTyping)
})
</script>