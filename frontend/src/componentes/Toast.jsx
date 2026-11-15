import { useState, useCallback } from 'react'
import { ToastContext } from '../lib/useToast'
import { avisarToki } from '../lib/toki'

// Los errores duran mas: un mensaje largo no alcanza a leerse en 3,4 s.
const DURACION = { success: 3400, warn: 5000, error: 8000 }
const SALIDA = 220 // lo que dura la animación de salida (estilos.css)

// Íconos propios por tipo de aviso (trazo con currentColor).
const ICONOS = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warn: <><path d="M12 8v5" /><path d="M12 16.5v.01" /></>,
  error: <><path d="M8 8l8 8" /><path d="M16 8l-8 8" /></>,
}

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])

  // Primero se marca como "saliendo" para animarlo y luego se quita.
  const cerrar = useCallback((id) => {
    setAvisos((a) => a.map((x) => (x.id === id ? { ...x, saliendo: true } : x)))
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), SALIDA)
  }, [])

  const toast = useCallback((mensaje, tipo = 'success') => {
    const id = Date.now() + Math.random()
    const clase = DURACION[tipo] ? tipo : 'success'
    setAvisos((a) => [...a, { id, mensaje, tipo: clase }])
    if (tipo === 'error') avisarToki('triste', '', { duracion: 5000 })
    setTimeout(() => cerrar(id), DURACION[clase])
  }, [cerrar])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* role="status" + aria-live hacen que un lector de pantalla anuncie
          el aviso. Sin esto, quien no ve la pantalla nunca se entera. */}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`aviso aviso-${a.tipo}${a.saliendo ? ' aviso-saliendo' : ''}`}
            style={{ '--aviso-duracion': `${DURACION[a.tipo]}ms` }}
          >
            <span className="aviso-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                {ICONOS[a.tipo]}
              </svg>
            </span>
            <span className="aviso-texto">{a.mensaje}</span>
            <button type="button" className="aviso-cerrar" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso">
              ×
            </button>
            <span className="aviso-barra" aria-hidden="true" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
