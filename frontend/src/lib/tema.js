import { useState } from 'react'

// El tema inicial lo pone un script en index.html antes de pintar, para que
// no se vea un destello claro. Usa esta misma clave de localStorage.
const CLAVE = 'atc-tema'

export function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema ?? 'claro')

  function alternar() {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro'
    document.documentElement.dataset.tema = nuevo
    setTema(nuevo)
    // Sin almacenamiento (modo privado) el cambio dura hasta recargar.
    try { localStorage.setItem(CLAVE, nuevo) } catch { /* no se guarda */ }
  }

  return { tema, alternar }
}
