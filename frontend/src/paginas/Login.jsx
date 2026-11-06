import { useState } from 'react'
import { supabase, traducirError } from '../lib/supabase'
import { useToast } from '../lib/useToast'
import { entrarConGoogle, entrarConTelefono, recuperarPorCorreo, reenviarConfirmacion, urlApp } from '../lib/datos'
import { cuentaYaExiste } from '../lib/registro'
import fotoFondo from '../../imagenes/cancha_1_wembley.webp'

// Botón "Continuar con Google". Sirve igual para entrar y para crear la
// cuenta: si es la primera vez, la cuenta se crea sola.
function BotonGoogle({ separador }) {
  const toast = useToast()
  const [yendo, setYendo] = useState(false)

  async function continuar() {
    setYendo(true)
    const { error } = await entrarConGoogle()
    // Si todo va bien el navegador ya se fue a Google.
    if (error) {
      setYendo(false)
      toast(error, 'error')
    }
  }

  return (
    <>
      <button type="button" className="boton-google" onClick={continuar} disabled={yendo}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {yendo ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      <div className="login-separador" role="separator"><span>{separador}</span></div>
    </>
  )
}

const BENEFICIOS = [
  { icono: '⚡', texto: 'Disponibilidad en tiempo real, sin llamadas' },
  { icono: '👥', texto: 'Completa tu equipo con partidos abiertos' },
  { icono: '🏆', texto: 'Inscribe a tu equipo en torneos' },
]

function Campo({ etiqueta, children }) {
  return (
    <label className="login-campo">
      <span>{etiqueta}</span>
      {children}
    </label>
  )
}

export function CampoClave({ etiqueta, valor, onCambio, placeholder, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <Campo etiqueta={etiqueta}>
      <div className="login-clave">
        <input
          className="input-moderno"
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="login-ojo"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </Campo>
  )
}

// Error visible dentro del formulario (además del aviso flotante).
function ErrorForm({ texto }) {
  return texto ? <p className="login-error" role="alert">⚠️ {texto}</p> : null
}

function FormEntrar({ onAutenticado, onOlvide }) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  // Correo o celular: si tiene @ es correo.
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [sinConfirmar, setSinConfirmar] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const esCorreo = usuario.includes('@')

  async function reenviar() {
    if (reenviando) return
    setReenviando(true)
    const { error } = await reenviarConfirmacion(usuario)
    setReenviando(false)
    if (error) {
      toast(error, 'error')
      return
    }
    toast('Te enviamos otro correo. Revisa también el correo no deseado.')
  }

  async function iniciarSesion(e) {
    e.preventDefault()
    if (enviando) return
    setError(null)
    setSinConfirmar(false)

    if (!esCorreo && usuario.replace(/\D/g, '').length < 10) {
      setError('Escribe tu correo o tu celular completo (10 dígitos).')
      return
    }
    if (!clave) {
      setError('Escribe tu contraseña.')
      return
    }

    setEnviando(true)
    let datos, mensaje
    if (esCorreo) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usuario.trim(),
        password: clave,
      })
      datos = data
      mensaje = error && traducirError(error)
      setSinConfirmar(error?.code === 'email_not_confirmed' || Boolean(error?.message?.includes('Email not confirmed')))
    } else {
      const { datos: sesion, error } = await entrarConTelefono(usuario, clave)
      datos = sesion
      mensaje = error
    }
    setEnviando(false)

    if (mensaje) {
      setError(mensaje)
      toast(mensaje, 'error')
      return
    }

    toast('Sesión iniciada.')
    if (onAutenticado) onAutenticado(datos.user)
  }

  return (
    <form onSubmit={iniciarSesion} className="login-form" noValidate>
      <Campo etiqueta="Correo o celular">
        <input
          className="input-moderno"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="tucorreo@ejemplo.com o 300 000 0000"
        />
      </Campo>

      <CampoClave etiqueta="Contraseña" valor={clave} onCambio={setClave} placeholder="••••••••" />

      <button type="button" className="login-link" onClick={() => onOlvide(esCorreo ? usuario.trim() : '')}>
        ¿Olvidaste tu contraseña?
      </button>

      <ErrorForm texto={error} />

      {sinConfirmar && (
        <button type="button" className="login-link" onClick={reenviar} disabled={reenviando}>
          {reenviando ? 'Enviando…' : 'Reenviar correo de confirmación'}
        </button>
      )}

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </button>
    </form>
  )
}

// Pide el correo y manda el enlace para cambiar la clave.
// El mensaje de éxito es el mismo exista o no la cuenta.
function FormRecuperar({ correoInicial, onVolver }) {
  const toast = useToast()
  const [correo, setCorreo] = useState(correoInicial ?? '')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return

    setEnviando(true)
    const { error } = await recuperarPorCorreo(correo)
    setEnviando(false)

    if (error) {
      toast(error, 'error')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="login-form recuperar-enviado" role="status">
        <span className="recuperar-icono">📬</span>
        <h3>Revisa tu correo</h3>
        <p>
          Si <strong>{correo.trim()}</strong> tiene una cuenta, te llegará un enlace para crear una contraseña nueva.
        </p>
        <p className="recuperar-nota">¿No lo encuentras? Revisa la carpeta de correo no deseado. El enlace vence en una hora.</p>
        <button type="button" className="btn-cta-primary login-submit" onClick={onVolver}>
          Volver a iniciar sesión
        </button>
        <button type="button" className="login-link" onClick={() => setEnviado(false)}>
          Enviar de nuevo
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="login-form">
      <Campo etiqueta="Correo de tu cuenta">
        <input
          className="input-moderno"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
        />
      </Campo>

      <p className="recuperar-nota">Te enviaremos un enlace para crear una contraseña nueva.</p>

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  )
}

function FormRegistro({ onRegistrado, onCuentaPendiente }) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')

  async function registrarse(e) {
    e.preventDefault()
    if (enviando) return
    setError(null)

    if (clave.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      toast('La contraseña debe tener al menos 8 caracteres.', 'error')
      return
    }

    setEnviando(true)

    const { data, error } = await supabase.auth.signUp({
      email: correo.trim(),
      password: clave,
      options: {
        data: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          rol: 'jugador',
        },
        emailRedirectTo: urlApp(),
      },
    })

    setEnviando(false)

    if (error) {
      setError(traducirError(error))
      toast(traducirError(error), 'error')
      return
    }

    if (cuentaYaExiste(data)) {
      const mensaje = 'Ya existe una cuenta con ese correo. Inicia sesión.'
      setError(mensaje)
      toast(mensaje, 'error')
      return
    }

    if (data.session) {
      // Cuenta lista al instante: la pantalla de bienvenida da las gracias.
      onRegistrado(nombre.trim())
    } else {
      // La pantalla de "Gracias" explica que debe confirmar el correo.
      onCuentaPendiente(correo.trim())
    }
  }

  return (
    <form onSubmit={registrarse} className="login-form">
      <Campo etiqueta="Nombre completo">
        <input
          className="input-moderno"
          type="text"
          required
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Juan Pérez"
        />
      </Campo>

      <div className="login-fila">
        <Campo etiqueta="Teléfono">
          <input
            className="input-moderno"
            type="tel"
            autoComplete="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="300 000 0000"
          />
        </Campo>
        <Campo etiqueta="Correo">
          <input
            className="input-moderno"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
          />
        </Campo>
      </div>

      <CampoClave
        etiqueta="Contraseña"
        valor={clave}
        onCambio={setClave}
        placeholder="Mínimo 8 caracteres"
        minLength={8}
      />

      <ErrorForm texto={error} />

      <p className="login-legal">
        Al crear tu cuenta aceptas los <a href="terminos/" target="_blank" rel="noreferrer">Términos y condiciones</a> y
        la <a href="privacidad/" target="_blank" rel="noreferrer">Política de Privacidad</a>.
      </p>

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </button>
    </form>
  )
}

const TEXTOS = {
  entrar: {
    titulo: '¡Qué bueno verte de nuevo!',
    subtitulo: 'Entra para reservar tu cancha y armar tu partido.',
  },
  registro: {
    titulo: 'Únete al equipo',
    subtitulo: 'Crea tu cuenta en menos de un minuto.',
  },
  recuperar: {
    titulo: '¿Olvidaste tu contraseña?',
    subtitulo: 'Indícanos tu correo y te ayudaremos a crear una nueva.',
  },
}

export default function Login({
  modoInicial = 'entrar', sedePendiente, onAutenticado, onRegistrado, onRegistroPendiente,
}) {
  const [modo, setModo] = useState(modoInicial)
  // Correo que ya había escrito al pulsar "¿Olvidaste tu contraseña?".
  const [correoOlvido, setCorreoOlvido] = useState('')

  function irARecuperar(correo) {
    setCorreoOlvido(correo)
    setModo('recuperar')
  }

  return (
    <main className="login-pagina">
      <section className="login-panel" style={{ backgroundImage: `url(${fotoFondo})` }}>
        <div className="login-panel-contenido">
          <span className="hero-badge">Cali · Canchas sintéticas</span>
          <h2 className="login-panel-titulo">
            Tu próximo partido
            <br />
            empieza <span>aquí.</span>
          </h2>
          <ul className="login-beneficios">
            {BENEFICIOS.map((b) => (
              <li key={b.texto}>
                <span className="login-beneficio-icono">{b.icono}</span>
                {b.texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login-lado-form">
        <div className="login-card">
          <h2 className="login-titulo">{TEXTOS[modo].titulo}</h2>
          <p className="login-subtitulo">{TEXTOS[modo].subtitulo}</p>

          {modo === 'recuperar' ? (
            <>
              <FormRecuperar correoInicial={correoOlvido} onVolver={() => setModo('entrar')} />
              <p className="login-pie">
                ¿Recordaste tu contraseña?{' '}
                <button type="button" className="login-link" onClick={() => setModo('entrar')}>
                  Inicia sesión
                </button>
              </p>
            </>
          ) : (
            <>
              {sedePendiente && (
                <p className="login-aviso">Inicia sesión para ver las canchas de la sede que elegiste ⚽</p>
              )}

              <div className={`login-tabs ${modo === 'registro' ? 'login-tabs-der' : ''}`}>
                <span className="login-tabs-fondo" />
                <button
                  type="button"
                  className={modo === 'entrar' ? 'activo' : ''}
                  onClick={() => setModo('entrar')}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={modo === 'registro' ? 'activo' : ''}
                  onClick={() => setModo('registro')}
                >
                  Registrarme
                </button>
              </div>

              <BotonGoogle separador={modo === 'entrar' ? 'o con tu correo o celular' : 'o con tu correo'} />

              {modo === 'entrar' ? (
                <FormEntrar onAutenticado={onAutenticado} onOlvide={irARecuperar} />
              ) : (
                <FormRegistro
                  onRegistrado={(nombre) => (onRegistrado ? onRegistrado(nombre) : onAutenticado?.())}
                  onCuentaPendiente={(correo) => (onRegistroPendiente ? onRegistroPendiente(correo) : setModo('entrar'))}
                />
              )}

              <p className="login-pie">
                {modo === 'entrar' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <button
                  type="button"
                  className="login-link"
                  onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
                >
                  {modo === 'entrar' ? 'Regístrate gratis' : 'Inicia sesión'}
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
