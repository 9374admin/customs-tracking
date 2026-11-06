import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus') || id.includes('@element-plus/icons-vue')) return 'vendor-element'
            if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
            if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue'
          }
        }
      }
    }
  }
})