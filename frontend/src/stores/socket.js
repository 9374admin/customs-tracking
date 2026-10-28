import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { useAuthStore } from './auth'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    onlineUsers: [],
    connected: false
  }),
  actions: {
    connect() {
      const auth = useAuthStore()
      if (!auth.token || this.socket) return
      this.socket = io('/', { auth: { token: auth.token }, transports: ['websocket'] })
      this.socket.on('connect', () => { this.connected = true })
      this.socket.on('disconnect', () => { this.connected = false })
      this.socket.on('users:online', (users) => { this.onlineUsers = users })
      this.socket.on('user:joined', (user) => {
        if (!this.onlineUsers.find(u => u.id === user.id)) {
          this.onlineUsers.push(user)
        }
      })
      this.socket.on('user:left', (user) => {
        this.onlineUsers = this.onlineUsers.filter(u => u.id !== user.id)
      })
    },
    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.connected = false
        this.onlineUsers = []
      }
    },
    on(event, cb) {
      if (this.socket) this.socket.on(event, cb)
    },
    off(event, cb) {
      if (this.socket) this.socket.off(event, cb)
    },
    emit(event, data) {
      if (this.socket) this.socket.emit(event, data)
    }
  }
})