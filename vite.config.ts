import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // RentCast proxy server (M3). If it isn't running, the app falls back to seed data.
      '/api': 'http://localhost:4517',
    },
  },
})
