import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simulación del pago con QR: las mismas pantallas, con datos en memoria.
//   npx vite --config vite.demo.config.js   →   http://localhost:5174/demo/
// Toda importación de lib/datos se cambia por demo/datosDemo.js, así que
// nada llega a Supabase.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^(?:\.\.\/)+lib\/datos$/,
        replacement: fileURLToPath(new URL('./demo/datosDemo.js', import.meta.url)),
      },
    ],
  },
  server: { host: true, port: 5174, open: '/demo/' },
})
