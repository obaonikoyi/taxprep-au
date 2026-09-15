import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../../sample-data', import.meta.url))] },
    proxy: {
      // Matches the explicit HTTP Development profile in DEVELOPMENT.md.
      // Production must route /api to the HTTPS backend on the same origin.
      '/api': { target: 'http://localhost:5087', changeOrigin: true },
    },
  },
})
