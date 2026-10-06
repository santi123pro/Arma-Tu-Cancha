import { useEffect, useState } from 'react'

// Segundos que faltan hasta `limite` (ISO o Date), actualizados cada
// segundo. Devuelve null si no hay límite y 0 cuando ya pasó.
export function useCuentaRegresiva(limite) {
  const fin = limite ? new Date(limite).getTime() : null
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!fin) return
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [fin])

  if (!fin) return null
  return Math.max(0, Math.floor((fin - ahora) / 1000))
}

// 754 → '12:34' · 4000 → '1 h 06 min'
export function formatoRestante(segundos) {
  if (segundos == null) return ''
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m}:${String(s).padStart(2, '0')}`
}
