import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The frontend runs on port 5173 and the backend runs on port 5087.
  // This development proxy forwards /api requests so the browser can treat
  // both applications as one local system without weakening backend security.
  server: {
    proxy: {
      '/api': 'http://localhost:5087',
    },
  },
})
