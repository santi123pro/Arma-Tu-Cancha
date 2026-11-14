import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../src/estilos.css'
import { ToastProvider } from '../src/componentes/Toast'
import Demo from './Demo'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Demo />
    </ToastProvider>
  </StrictMode>,
)
