import { useEffect, useState } from 'react'
import { supabase, vieneDeRecuperacion } from './supabase'
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
 *   recuperando — true si el usuario llegó por el enlace de "olvidé mi
 *                  contraseña" y aún no ha puesto la nueva
 *   terminarRecuperacion — se llama cuando ya cambió la contraseña
 */
export function useSesion() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [recuperando, setRecuperando] = useState(vieneDeRecuperacion)

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
      async (evento, session) => {
        if (!vivo) return
        if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
        setUsuario(session?.user ?? null)
        await cargarPerfil(session?.user)
      }
    )

    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  const esAdmin = perfil?.rol === 'admin_sede' || perfil?.rol === 'superadmin'

  function terminarRecuperacion() {
    setRecuperando(false)
    // Quita ?recuperar=1 para que al refrescar no vuelva a pedir la clave.
    window.history.replaceState(null, '', window.location.pathname)
  }

  return {
    usuario, perfil, cargando, esAdmin, autenticado: Boolean(usuario),
    recuperando, terminarRecuperacion,
  }
}
