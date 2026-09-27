import { useState } from 'react'
import { supabase, traducirError } from '../lib/supabase'
import { useToast } from '../componentes/Toast'

export default function Auth({ onAutenticado }) {
  const toast = useToast()
  const [enviandoLogin, setEnviandoLogin] = useState(false)
  const [enviandoRegistro, setEnviandoRegistro] = useState(false)

  // caja de iniciar sesion
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')

  // caja de registro
  const [nombreR, setNombreR] = useState('')
  const [telefonoR, setTelefonoR] = useState('')
  const [correoR, setCorreoR] = useState('')
  const [claveR, setClaveR] = useState('')

  async function iniciarSesion(e) {
    e.preventDefault()
    if (enviandoLogin) return
    setEnviandoLogin(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    })

    setEnviandoLogin(false)

    if (error) {
      toast(traducirError(error), 'error')
      return
    }

    toast('Sesion iniciada', 'exito')
    if (onAutenticado) onAutenticado(data.user)
  }

  async function registrarse(e) {
    e.preventDefault()
    if (enviandoRegistro) return

    if (claveR.length < 8) {
      toast('La contrasena necesita al menos 8 caracteres', 'error')
      return
    }

    setEnviandoRegistro(true)

    const { data, error } = await supabase.auth.signUp({
      email: correoR.trim(),
      password: claveR,
      options: {
        data: {
          nombre: nombreR.trim(),
          telefono: telefonoR.trim(),
          rol: 'jugador',
        },
      },
    })

    setEnviandoRegistro(false)

    if (error) {
      toast(traducirError(error), 'error')
      return
    }

    if (data.session) {
      toast('Cuenta creada. Ya estas dentro', 'exito')
      if (onAutenticado) onAutenticado(data.user)
    } else {
      toast('Cuenta creada. Revisa tu correo para confirmarla', 'exito')
    }
  }

  async function recuperar(e) {
    e.preventDefault()

    if (!correo.trim()) {
      toast('Escribe tu correo en el campo de arriba', 'error')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin,
    })

    if (error) {
      toast(traducirError(error), 'error')
      return
    }

    toast('Te enviamos un enlace para cambiar la contrasena', 'exito')
  }

  return (
    <div className="auth-landing-container" id="auth-landing">
      {/* ── Caja 1: iniciar sesion ── */}
      <div className="auth-card-landing" style={{ width: 'min(360px, 100%)' }}>
        <h2>Iniciar sesion</h2>
        <p>Ya tienes cuenta? Entra y reserva tu cancha.</p>

        <form onSubmit={iniciarSesion}>
          <input
            className="input-moderno"
            type="email"
            required
            value={correo}
            onChange={function (e) {
              setCorreo(e.target.value)
            }}
            placeholder="Correo"
          />
          <input
            className="input-moderno"
            type="password"
            required
            value={clave}
            onChange={function (e) {
              setClave(e.target.value)
            }}
            placeholder="Contrasena"
          />

          <button
            type="submit"
            className="btn-cta-primary"
            disabled={enviandoLogin}
            style={{ width: '100%', marginTop: 12 }}
          >
            {enviandoLogin ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
          <a href="#" onClick={recuperar}>
            Olvide mi contrasena
          </a>
        </p>
      </div>

      {/* ── Caja 2: registro ── */}
      <div className="auth-card-landing" style={{ width: 'min(360px, 100%)' }}>
        <h2>Crear cuenta</h2>
        <p>Registrate gratis para reservar y unirte a partidos.</p>

        <form onSubmit={registrarse}>
          <input
            className="input-moderno"
            type="text"
            required
            value={nombreR}
            onChange={function (e) {
              setNombreR(e.target.value)
            }}
            placeholder="Nombre completo"
          />
          <input
            className="input-moderno"
            type="tel"
            value={telefonoR}
            onChange={function (e) {
              setTelefonoR(e.target.value)
            }}
            placeholder="Telefono"
          />
          <input
            className="input-moderno"
            type="email"
            required
            value={correoR}
            onChange={function (e) {
              setCorreoR(e.target.value)
            }}
            placeholder="Correo"
          />
          <input
            className="input-moderno"
            type="password"
            required
            minLength={8}
            value={claveR}
            onChange={function (e) {
              setClaveR(e.target.value)
            }}
            placeholder="Contrasena (minimo 8)"
          />

          <button
            type="submit"
            className="btn-cta-primary"
            disabled={enviandoRegistro}
            style={{ width: '100%', marginTop: 12 }}
          >
            {enviandoRegistro ? 'Creando...' : 'Registrarme'}
          </button>
        </form>
      </div>
    </div>
  )
}
