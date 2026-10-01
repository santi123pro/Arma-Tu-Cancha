import { useState } from 'react'
import { supabase, traducirError } from '../lib/supabase'
import { useToast } from '../componentes/Toast'
import { recuperarPorCorreo, recuperarPorTelefono } from '../lib/datos'
import fotoFondo from '../../imagenes/cancha_1_wembley.jpeg'

const BENEFICIOS = [
  { icono: '⚡', texto: 'Disponibilidad en tiempo real, sin llamadas' },
  { icono: '👥', texto: 'Completa tu equipo con partidos abiertos' },
  { icono: '🏆', texto: 'Organiza torneos con tus amigos' },
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

function FormEntrar({ onAutenticado, onOlvide }) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')

  async function iniciarSesion(e) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    })

    setEnviando(false)

    if (error) {
      toast(traducirError(error), 'error')
      return
    }

    toast('Sesión iniciada')
    if (onAutenticado) onAutenticado(data.user)
  }

  return (
    <form onSubmit={iniciarSesion} className="login-form">
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

      <CampoClave etiqueta="Contraseña" valor={clave} onCambio={setClave} placeholder="••••••••" />

      <button type="button" className="login-link" onClick={() => onOlvide(correo.trim())}>
        ¿Olvidaste tu contraseña?
      </button>

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar a la cancha'}
      </button>
    </form>
  )
}

// Pide el correo o el teléfono y manda el enlace para cambiar la clave.
// El mensaje de éxito es el mismo exista o no la cuenta.
function FormRecuperar({ correoInicial, onVolver }) {
  const toast = useToast()
  const [via, setVia] = useState('correo')
  const [correo, setCorreo] = useState(correoInicial ?? '')
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return

    if (via === 'telefono' && telefono.replace(/\D/g, '').length < 7) {
      toast('Escribe un número de teléfono válido', 'error')
      return
    }

    setEnviando(true)
    const { error } = via === 'correo'
      ? await recuperarPorCorreo(correo)
      : await recuperarPorTelefono(telefono)
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
          {via === 'correo'
            ? <>Si <strong>{correo.trim()}</strong> tiene una cuenta, te llegará un enlace para crear una contraseña nueva.</>
            : <>Si ese número está registrado, enviamos un enlace al correo de la cuenta para crear una contraseña nueva.</>}
        </p>
        <p className="recuperar-nota">¿No lo ves? Revisa la carpeta de spam. El enlace vence en una hora.</p>
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
    <form onSubmit={enviar} className="login-form" noValidate={via === 'telefono'}>
      <div className={`login-tabs ${via === 'telefono' ? 'login-tabs-der' : ''}`}>
        <span className="login-tabs-fondo" />
        <button type="button" className={via === 'correo' ? 'activo' : ''} onClick={() => setVia('correo')}>
          ✉️ Con mi correo
        </button>
        <button type="button" className={via === 'telefono' ? 'activo' : ''} onClick={() => setVia('telefono')}>
          📱 Con mi teléfono
        </button>
      </div>

      {via === 'correo' ? (
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
      ) : (
        <Campo etiqueta="Teléfono con el que te registraste">
          <input
            className="input-moderno"
            type="tel"
            required
            autoFocus
            autoComplete="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="300 000 0000"
          />
        </Campo>
      )}

      <p className="recuperar-nota">
        {via === 'correo'
          ? 'Te enviaremos un enlace para crear una contraseña nueva.'
          : 'Buscaremos tu cuenta y enviaremos el enlace al correo con el que te registraste.'}
      </p>

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  )
}

function FormRegistro({ onAutenticado, onCuentaPendiente }) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')

  async function registrarse(e) {
    e.preventDefault()
    if (enviando) return

    if (clave.length < 8) {
      toast('La contraseña necesita al menos 8 caracteres', 'error')
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
      },
    })

    setEnviando(false)

    if (error) {
      toast(traducirError(error), 'error')
      return
    }

    if (data.session) {
      toast('Cuenta creada. Ya estás dentro')
      if (onAutenticado) onAutenticado(data.user)
    } else {
      toast('Cuenta creada. Revisa tu correo para confirmarla')
      onCuentaPendiente()
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

      <button type="submit" className="btn-cta-primary login-submit" disabled={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear mi cuenta gratis'}
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
    subtitulo: 'Crea tu cuenta gratis en menos de un minuto.',
  },
  recuperar: {
    titulo: '¿Olvidaste tu contraseña?',
    subtitulo: 'Tranquilo, pasa. Dinos tu correo o tu teléfono y te ayudamos a crear una nueva.',
  },
}

export default function Login({ modoInicial = 'entrar', sedePendiente, onAutenticado, onVolver }) {
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
          <span className="hero-badge">Cali · Fútbol 6</span>
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
          <button type="button" className="login-link login-volver" onClick={onVolver}>
            ← Volver al inicio
          </button>

          <h2 className="login-titulo">{TEXTOS[modo].titulo}</h2>
          <p className="login-subtitulo">{TEXTOS[modo].subtitulo}</p>

          {modo === 'recuperar' ? (
            <>
              <FormRecuperar correoInicial={correoOlvido} onVolver={() => setModo('entrar')} />
              <p className="login-pie">
                ¿Te acordaste?{' '}
                <button type="button" className="login-link" onClick={() => setModo('entrar')}>
                  Inicia sesión
                </button>
              </p>
            </>
          ) : (
            <>
              {sedePendiente && (
                <p className="login-aviso">Inicia sesión para ver las canchas de esa sede ⚽</p>
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

              {modo === 'entrar' ? (
                <FormEntrar onAutenticado={onAutenticado} onOlvide={irARecuperar} />
              ) : (
                <FormRegistro onAutenticado={onAutenticado} onCuentaPendiente={() => setModo('entrar')} />
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
