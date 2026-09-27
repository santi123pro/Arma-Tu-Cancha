import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { miPerfil } from './datos'

/**
 * Hook de sesión.
 *
 * Reemplaza a tu manejo de localStorage con el token JWT. Supabase guarda
 * y renueva la sesión solo; aquí únicamente escuchamos los cambios.
 *
 * Devuelve:
 *   usuario  — el registro de auth.users, o null si no hay sesión
 *   perfil   — la fila de la tabla perfiles (nombre, rol, sede_id)
 *   cargando — true mientras se resuelve la sesión inicial
 */
export function useSesion() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true

    async function cargarPerfil(u) {
      if (!u) { setPerfil(null); return }
      const { datos } = await miPerfil()
      if (vivo) setPerfil(datos)
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!vivo) return
      setUsuario(session?.user ?? null)
      await cargarPerfil(session?.user)
      if (vivo) setCargando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_evento, session) => {
        if (!vivo) return
        setUsuario(session?.user ?? null)
        await cargarPerfil(session?.user)
      }
    )

    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  const esAdmin = perfil?.rol === 'admin_sede' || perfil?.rol === 'superadmin'

  return { usuario, perfil, cargando, esAdmin, autenticado: Boolean(usuario) }
}
