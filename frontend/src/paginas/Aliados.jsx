import { useState } from 'react'
import { enviarSolicitudSede } from '../lib/datos'
import { balonazo } from '../lib/balonazo'

// "Trabaja con nosotros": dueños de canchas que quieren estar en la
// plataforma. La solicitud se guarda en solicitudes_sedes (migración 0012)
// y el superadmin la ve en el panel.

const TIPOS = ['Fútbol 5', 'Fútbol 6', 'Fútbol 7', 'Fútbol 8', 'Fútbol 11']

const BENEFICIOS = [
  { icono: '📅', titulo: 'Reservas 24/7', texto: 'Tus clientes reservan solos, sin llamadas ni mensajes a media noche.' },
  { icono: '👥', titulo: 'Más jugadores', texto: 'Los partidos abiertos llenan los horarios que antes quedaban vacíos.' },
  { icono: '📊', titulo: 'Tus métricas', texto: 'Panel con reservas, ingresos y ocupación de cada cancha.' },
  { icono: '🏆', titulo: 'Torneos', texto: 'Organiza torneos e inscripciones desde la misma plataforma.' },
]

const FORM_VACIO = {
  contacto_nombre: '', contacto_cargo: '', correo: '', telefono: '',
  establecimiento: '', ciudad: 'Cali', direccion: '', num_canchas: '',
  hora_apertura: '', hora_cierre: '', razon_social: '', nit: '', mensaje: '',
  sitio_web: '', // trampa para bots: un humano no la ve ni la llena
}

export default function Aliados({ onIr }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [tipos, setTipos] = useState([])
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [enviada, setEnviada] = useState(false)

  function cambiar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  function alternarTipo(t) {
    setTipos((lista) => (lista.includes(t) ? lista.filter((x) => x !== t) : [...lista, t]))
  }

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return
    setError(null)

    // Un bot llenó el campo oculto: se finge el envío y no se guarda nada.
    if (form.sitio_web) return setEnviada(true)

    const canchas = Number(form.num_canchas)
    if (!form.contacto_nombre.trim()) return setError('Escribe tu nombre.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.correo.trim())) return setError('Escribe un correo válido.')
    if (form.telefono.replace(/\D/g, '').length < 7) return setError('Escribe un celular o teléfono válido.')
    if (!form.establecimiento.trim()) return setError('Escribe el nombre del establecimiento.')
    if (!form.direccion.trim()) return setError('Escribe la dirección del establecimiento.')
    if (!Number.isInteger(canchas) || canchas < 1 || canchas > 50) return setError('El número de canchas debe estar entre 1 y 50.')
    if (form.hora_apertura && form.hora_cierre && form.hora_cierre <= form.hora_apertura) {
      return setError('La hora de cierre debe ser después de la de apertura.')
    }
    if (!acepta) return setError('Debes autorizar el tratamiento de tus datos para enviar la solicitud.')

    const texto = (v) => v.trim() || null
    setEnviando(true)
    const { error } = await enviarSolicitudSede({
      contacto_nombre: form.contacto_nombre.trim(),
      contacto_cargo: texto(form.contacto_cargo),
      correo: form.correo.trim(),
      telefono: form.telefono.trim(),
      establecimiento: form.establecimiento.trim(),
      ciudad: form.ciudad.trim() || 'Cali',
      direccion: form.direccion.trim(),
      num_canchas: canchas,
      tipos_cancha: tipos.length ? tipos.join(', ') : null,
      hora_apertura: form.hora_apertura || null,
      hora_cierre: form.hora_cierre || null,
      razon_social: texto(form.razon_social),
      nit: texto(form.nit),
      mensaje: texto(form.mensaje),
      acepta_datos: true,
    })
    setEnviando(false)

    if (error) return setError(error)
    await balonazo()
    setEnviada(true)
    window.scrollTo({ top: 0 })
  }

  if (enviada) {
    return (
      <main className="pagina-estado">
        <div className="estado-tarjeta">
          <p className="estado-icono" aria-hidden="true">🤝</p>
          <h1>¡Gracias, recibimos tu solicitud!</h1>
          <p>
            Revisaremos los datos de <strong>{form.establecimiento || 'tu establecimiento'}</strong> y
            te contactaremos en los próximos días al correo o al celular que nos dejaste.
          </p>
          <button type="button" className="btn-cta-primary" onClick={() => onIr('portada')}>
            Volver al inicio
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="pagina-partidos pagina-aliados">
      <section className="partidos-hero">
        <div className="partidos-hero-contenido">
          <span className="hero-badge">Trabaja con nosotros</span>
          <h1 className="partidos-hero-titulo">
            ¿Tienes una cancha? <span>Súmala al equipo.</span>
          </h1>
          <p className="partidos-hero-desc">
            Lleva tu establecimiento a Arma Tu Cancha: más reservas, menos llamadas y todo
            organizado en un solo lugar. Déjanos tus datos y te contactamos.
          </p>
        </div>
      </section>

      <div className="partidos-contenedor">
        <div className="aliados-beneficios">
          {BENEFICIOS.map((b) => (
            <article key={b.titulo} className="aliados-beneficio">
              <span aria-hidden="true">{b.icono}</span>
              <h3>{b.titulo}</h3>
              <p>{b.texto}</p>
            </article>
          ))}
        </div>

        <section className="seccion-partidos">
          <div className="partidos-bloque">
          <form className="form-partido" onSubmit={enviar} noValidate>
            <h2 className="landing-title form-partido-completo">Tus datos</h2>
            <label>
              Nombre completo *
              <input className="input-moderno" autoComplete="name" value={form.contacto_nombre}
                onChange={cambiar('contacto_nombre')} placeholder="Juan Pérez" maxLength={100} />
            </label>
            <label>
              Cargo
              <input className="input-moderno" value={form.contacto_cargo}
                onChange={cambiar('contacto_cargo')} placeholder="Dueño, administrador…" maxLength={60} />
            </label>
            <label>
              Correo *
              <input className="input-moderno" type="email" autoComplete="email" value={form.correo}
                onChange={cambiar('correo')} placeholder="tucorreo@ejemplo.com" maxLength={160} />
            </label>
            <label>
              Celular / WhatsApp *
              <input className="input-moderno" type="tel" autoComplete="tel" value={form.telefono}
                onChange={cambiar('telefono')} placeholder="300 000 0000" maxLength={30} />
            </label>

            <h2 className="landing-title form-partido-completo aliados-subtitulo">Tu establecimiento</h2>
            <label className="form-partido-completo">
              Nombre del establecimiento *
              <input className="input-moderno" autoComplete="organization" value={form.establecimiento}
                onChange={cambiar('establecimiento')} placeholder="Ej.: Canchas El Golazo" maxLength={120} />
            </label>
            <label>
              Ciudad *
              <input className="input-moderno" value={form.ciudad} onChange={cambiar('ciudad')} maxLength={80} />
            </label>
            <label>
              Dirección *
              <input className="input-moderno" autoComplete="street-address" value={form.direccion}
                onChange={cambiar('direccion')} placeholder="Calle 00 # 00-00, barrio" maxLength={200} />
            </label>
            <label>
              Número de canchas *
              <input className="input-moderno" type="number" min={1} max={50} value={form.num_canchas}
                onChange={cambiar('num_canchas')} placeholder="3" />
            </label>
            <div className="aliados-horario">
              <label>
                Abre
                <input className="input-moderno" type="time" value={form.hora_apertura} onChange={cambiar('hora_apertura')} />
              </label>
              <label>
                Cierra
                <input className="input-moderno" type="time" value={form.hora_cierre} onChange={cambiar('hora_cierre')} />
              </label>
            </div>
            <fieldset className="form-partido-completo aliados-tipos">
              <legend>Tipos de cancha</legend>
              {TIPOS.map((t) => (
                <label key={t} className={'aliados-chip' + (tipos.includes(t) ? ' activo' : '')}>
                  <input type="checkbox" checked={tipos.includes(t)} onChange={() => alternarTipo(t)} />
                  {t}
                </label>
              ))}
            </fieldset>

            <h2 className="landing-title form-partido-completo aliados-subtitulo">
              Datos de la empresa <small>(opcional)</small>
            </h2>
            <label>
              Razón social
              <input className="input-moderno" value={form.razon_social}
                onChange={cambiar('razon_social')} placeholder="Canchas El Golazo S.A.S." maxLength={150} />
            </label>
            <label>
              NIT
              <input className="input-moderno" value={form.nit}
                onChange={cambiar('nit')} placeholder="900.000.000-0" maxLength={30} />
            </label>
            <label className="form-partido-completo">
              ¿Algo más que debamos saber?
              <textarea className="input-moderno aliados-mensaje" value={form.mensaje} onChange={cambiar('mensaje')}
                maxLength={2000} rows={4}
                placeholder="Tipo de superficie, si tienen iluminación, cómo manejan hoy las reservas…" />
            </label>

            {/* Trampa para bots: oculta para las personas y los lectores de pantalla. */}
            <label className="aliados-trampa" aria-hidden="true">
              Sitio web
              <input tabIndex={-1} autoComplete="off" value={form.sitio_web} onChange={cambiar('sitio_web')} />
            </label>

            <label className="form-partido-completo aliados-acepta">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                Autorizo a Arma Tu Cancha a tratar estos datos para estudiar mi solicitud y
                contactarme, según la{' '}
                {/* En otra pestaña, para no perder lo que ya escribió. */}
                <a href={`${import.meta.env.BASE_URL}privacidad/`} target="_blank" rel="noreferrer">
                  Política de Privacidad
                </a>.
              </span>
            </label>

            {error && <p className="form-partido-completo login-error" role="alert">⚠️ {error}</p>}

            <button type="submit" className="btn-cta-primary form-partido-completo" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
          </div>
        </section>
      </div>
    </main>
  )
}
