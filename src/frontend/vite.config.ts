import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The frontend runs on port 5173 and the HTTPS backend runs on port 7087.
  // This development-only proxy acts like a receptionist: it receives /api
  // requests from React and transfers them to ASP.NET Core.
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:7087',
        changeOrigin: true,
        // ASP.NET uses a trusted local development certificate on your PC.
        // Vite runs through Node.js, which uses a separate trust store, so this
        // local-only option allows that certificate. Production must validate
        // certificates normally and must never copy this setting.
        secure: false,
      },
    },
  },
})
