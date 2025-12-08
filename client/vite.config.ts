import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const CLIENT_PORT = process.env.CLIENT_PORT ? parseInt(process.env.CLIENT_PORT, 10) : 3000
const SERVER_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: CLIENT_PORT,
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
