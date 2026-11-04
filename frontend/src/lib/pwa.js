import { useEffect, useState } from 'react'

// Chrome avisa una sola vez que la app se puede instalar, a veces antes de
// que React pinte: por eso el aviso se guarda aquí desde que carga la página.
let avisoInstalar = null
const interesados = new Set()

function avisar() {
  interesados.forEach((fn) => fn(avisoInstalar))
}

export function activarPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    avisoInstalar = e
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    avisoInstalar = null
    avisar()
  })

  // Solo en producción: en local el service worker estorbaría a la recarga de Vite.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
    })
  }
}

// → función para abrir el diálogo de instalación, o null si no se puede ofrecer
// (ya está instalada, o el navegador no lo permite, como Safari en iPhone).
export function useInstalarApp() {
  const [aviso, setAviso] = useState(avisoInstalar)

  useEffect(() => {
    interesados.add(setAviso)
    return () => { interesados.delete(setAviso) }
  }, [])

  if (!aviso) return null
  return async () => {
    await aviso.prompt()
    avisoInstalar = null
    avisar()
  }
}

export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)

  useEffect(() => {
    const cambiar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', cambiar)
    window.addEventListener('offline', cambiar)
    return () => {
      window.removeEventListener('online', cambiar)
      window.removeEventListener('offline', cambiar)
    }
  }, [])

  return enLinea
}
