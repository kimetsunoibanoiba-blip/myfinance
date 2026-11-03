import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' membuat aplikasi bisa di-host di root domain maupun subfolder (mis. GitHub Pages).
export default defineConfig({ base: './', plugins: [react()], build: { target: 'es2020', chunkSizeWarningLimit: 900 } })
