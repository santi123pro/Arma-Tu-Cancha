import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])

  const toast = useCallback((mensaje, tipo = 'success') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, mensaje, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3400)
  }, [])

  const color = { success: '#16a34a', warn: '#d97706', error: '#dc2626' }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {avisos.map((a) => (
          <div key={a.id} style={{
            background: color[a.tipo] ?? color.success, color: '#fff',
            padding: '13px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0,0,0,.25)', maxWidth: 380, lineHeight: 1.4,
          }}>
            {a.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)