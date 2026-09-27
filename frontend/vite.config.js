import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En local BASE_PATH no existe, así que la base es '/'.
// En GitHub Actions llega como '/Arma-Tu-Cancha/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
