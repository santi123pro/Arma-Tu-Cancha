import { useCallback, useEffect, useState } from 'react'
import { detalleSede } from './datos'

// Última versión de cada sede. Al cambiar de pestaña dentro de una sede se
// pinta de inmediato con esto y se actualiza por detrás, sin pantalla de carga.
const recientes = new Map()

export function useDetalleSede(slug) {
  const [estado, setEstado] = useState(() => ({
    sede: recientes.get(slug) ?? null,
    cargando: !recientes.has(slug),
    error: null,
  }))
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    detalleSede(slug).then(({ datos, error }) => {
      if (!vigente) return
      if (datos) recientes.set(slug, datos)
      setEstado((e) => ({ sede: datos ?? e.sede, cargando: false, error }))
    })
    return () => { vigente = false }
  }, [slug, intento])

  const reintentar = useCallback(() => {
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    setIntento((n) => n + 1)
  }, [])

  return { ...estado, reintentar }
}
