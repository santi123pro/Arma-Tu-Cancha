import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])

  const cerrar = useCallback((id) => {
    setAvisos((a) => a.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback((mensaje, tipo = 'success') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, mensaje, tipo }])
    // Los errores duran mas: un mensaje largo no alcanza a leerse en 3,4 s.
    setTimeout(() => cerrar(id), tipo === 'error' ? 8000 : 3400)
  }, [cerrar])

  const color = { success: '#16a34a', warn: '#d97706', error: '#dc2626' }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* role="status" + aria-live hacen que un lector de pantalla anuncie
          el aviso. Sin esto, quien no ve la pantalla nunca se entera. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10,
          pointerEvents: 'none',
        }}
      >
        {avisos.map((a) => (
          <div key={a.id} style={{
            background: color[a.tipo] ?? color.success, color: '#fff',
            padding: '13px 16px 13px 22px', borderRadius: 10, fontSize: 14,
            fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.25)',
            maxWidth: 380, lineHeight: 1.4, pointerEvents: 'auto',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span>{a.mensaje}</span>
            <button
              type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso"
              style={{
                background: 'transparent', border: 'none', color: '#fff',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0,
                opacity: .8, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)