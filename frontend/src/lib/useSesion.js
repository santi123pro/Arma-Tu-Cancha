import { useEffect, useState } from 'react'
import { supabase, vieneDeRecuperacion } from './supabase'
import { miPerfil, PERFIL_ACTUALIZADO } from './datos'
import { faltaCodigo, tieneFactor } from './mfa'

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
 *   necesitaCodigo — la cuenta tiene verificación en dos pasos y esta
 *                    sesión todavía no escribió el código de la app
 *   debeActivarMfa — el superadmin le exige la verificación y aún no
 *                    configuró la app autenticadora
 */
export function useSesion() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [recuperando, setRecuperando] = useState(vieneDeRecuperacion)
  const [necesitaCodigo, setNecesitaCodigo] = useState(false)

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
      setNecesitaCodigo(faltaCodigo(session))
      await cargarPerfil(session?.user)
      if (vivo) setCargando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (evento, session) => {
        if (!vivo) return
        if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
        setUsuario(session?.user ?? null)
        setNecesitaCodigo(faltaCodigo(session))
        await cargarPerfil(session?.user)
      }
    )

    // "Mi cuenta" guardó cambios: se vuelve a leer el perfil.
    async function recargarPerfil() {
      const { data: { session } } = await supabase.auth.getSession()
      await cargarPerfil(session?.user)
    }
    window.addEventListener(PERFIL_ACTUALIZADO, recargarPerfil)

    return () => {
      vivo = false
      subscription.unsubscribe()
      window.removeEventListener(PERFIL_ACTUALIZADO, recargarPerfil)
    }
  }, [])

  const debeActivarMfa = Boolean(usuario && perfil?.mfa_obligatorio && !tieneFactor(usuario))

  const esAdmin = perfil?.rol === 'admin_sede' || perfil?.rol === 'superadmin'

  function terminarRecuperacion() {
    setRecuperando(false)
    // Quita ?recuperar=1 para que al refrescar no vuelva a pedir la clave.
    window.history.replaceState(null, '', window.location.pathname)
  }

  return {
    usuario, perfil, cargando, esAdmin, autenticado: Boolean(usuario),
    recuperando, terminarRecuperacion, necesitaCodigo, debeActivarMfa,
  }
}
