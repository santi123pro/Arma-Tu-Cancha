import { useEffect, useState } from 'react'
import { hoyLocal } from '../lib/formato'
import { crearTorneo, inscribirEquipo, listarTorneos } from '../lib/datos'
import { useSesion } from '../lib/useSesion'
import { useToast } from '../componentes/Toast'
import Cargando from '../componentes/Cargando'
import EquiposTorneo from '../componentes/EquiposTorneo'
import { balonazo } from '../lib/balonazo'

const MODALIDADES = ['Fútbol 5', 'Fútbol 6', 'Fútbol 7', 'Fútbol 8', 'Fútbol 11']

// Los valores son los que acepta el CHECK torneos_estado_valido.
const ESTADOS = {
  inscripciones: { texto: 'Inscripciones abiertas', clase: 'estado-abierto' },
  cerrado: { texto: 'Cupos completos', clase: 'estado-cerrado' },
  en_curso: { texto: 'En curso', clase: 'estado-curso' },
  finalizado: { texto: 'Finalizado', clase: 'estado-fin' },
  cancelado: { texto: 'Cancelado', clase: 'estado-fin' },
}

const FORM_VACIO = {
  nombre: '',
  modalidad: 'Fútbol 6',
  cupos: '8',
  fechaInicio: '',
  cierre: '',
  premio: '',
  descripcion: '',
}


// '2026-10-05' → 'dom 5 de oct'
function fechaCorta(fecha) {
  if (!fecha) return null
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function TarjetaTorneo({ torneo, autenticado, administra, onInscrito }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [equipo, setEquipo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const estado = ESTADOS[torneo.estado] ?? { texto: torneo.estado, clase: 'estado-fin' }
  const libres = torneo.cupos_totales - torneo.cupos_inscritos
  const puedeInscribir = torneo.estado === 'inscripciones' && libres > 0

  async function inscribir(e) {
    e.preventDefault()
    if (enviando) return
    if (!equipo.trim()) {
      toast('Escribe el nombre de tu equipo.', 'error')
      return
    }

    setEnviando(true)
    const { error } = await inscribirEquipo(torneo.id, equipo.trim())
    setEnviando(false)

    if (error) {
      toast(error, 'error')
      return
    }

    toast('¡Equipo inscrito! 🏆')
    setEquipo('')
    setAbierto(false)
    onInscrito()
  }

  return (
    <article className="tarjeta-cancha tarjeta-torneo">
      <div className="torneo-cabeza">
        <h3>{torneo.nombre}</h3>
        <span className={'torneo-estado ' + estado.clase}>{estado.texto}</span>
      </div>

      {torneo.descripcion && <p className="torneo-desc">{torneo.descripcion}</p>}

      <div className="torneo-datos">
        <span>⚽ {torneo.modalidad}</span>
        {torneo.fecha_inicio && <span>📅 Inicia el {fechaCorta(torneo.fecha_inicio)}</span>}
        {torneo.cierre_inscripcion && <span>⏳ Inscripciones hasta el {fechaCorta(torneo.cierre_inscripcion)}</span>}
      </div>

      {torneo.premio && <p className="torneo-premio">🏆 {torneo.premio}</p>}

      <div className="partido-cupos">
        <p><span>{torneo.cupos_inscritos}</span> de {torneo.cupos_totales} equipos inscritos</p>
        <div className="partido-barra">
          <i style={{ width: `${(torneo.cupos_inscritos / torneo.cupos_totales) * 100}%` }} />
        </div>
      </div>

      {administra && <EquiposTorneo torneo={torneo} />}

      {!puedeInscribir ? null : !autenticado ? (
        <p className="torneo-nota">Inicia sesión para inscribir tu equipo.</p>
      ) : abierto ? (
        <form className="torneo-inscribir" onSubmit={inscribir}>
          <input
            className="input-moderno"
            autoFocus
            maxLength={150}
            value={equipo}
            onChange={(e) => setEquipo(e.target.value)}
            placeholder="Nombre de tu equipo"
          />
          <div className="torneo-inscribir-botones">
            <button type="button" className="btn-torneo-cancelar" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-cta-primary" disabled={enviando}>
              {enviando ? 'Inscribiendo…' : 'Confirmar'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-cta-primary" onClick={() => setAbierto(true)}>
          Inscribir mi equipo
        </button>
      )}
    </article>
  )
}

export default function Torneos({ sedeId, sedeNombre }) {
  const { autenticado, esAdmin, perfil } = useSesion()
  // Ve los equipos con sus datos quien administra esta sede.
  const administra = perfil?.rol === 'superadmin' || (perfil?.rol === 'admin_sede' && perfil?.sede_id === sedeId)
  const toast = useToast()
  const hoy = hoyLocal()

  const [form, setForm] = useState(FORM_VACIO)
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  const [torneos, setTorneos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorLista, setErrorLista] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    listarTorneos(sedeId).then(({ datos, error }) => {
      if (!vigente) return
      setErrorLista(error ?? null)
      if (!error) setTorneos(datos ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [sedeId, recarga])

  function recargar() {
    setCargando(true)
    setRecarga((n) => n + 1)
  }

  function cambiar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function publicar(e) {
    e.preventDefault()
    if (publicando) return
    setErrorForm(null)

    const cupos = Number(form.cupos)
    if (!form.nombre.trim()) return setErrorForm('Escribe el nombre del torneo.')
    if (!Number.isInteger(cupos) || cupos < 4 || cupos > 12) {
      return setErrorForm('El torneo debe tener entre 4 y 12 equipos.')
    }
    if (form.fechaInicio && form.fechaInicio < hoy) return setErrorForm('La fecha de inicio ya pasó.')
    if (form.cierre && form.fechaInicio && form.cierre > form.fechaInicio) {
      return setErrorForm('El cierre de inscripciones debe ser anterior a la fecha de inicio.')
    }

    setPublicando(true)
    const { error } = await crearTorneo({
      sedeId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      modalidad: form.modalidad,
      cuposTotales: cupos,
      fechaInicio: form.fechaInicio || null,
      cierreInscripcion: form.cierre || null,
      premio: form.premio.trim() || null,
    })
    setPublicando(false)

    if (error) {
      setErrorForm(error)
      toast(error, 'error')
      return
    }

    setForm(FORM_VACIO)
    recargar()
    await balonazo()
    toast('¡Torneo creado! Ya aparece en la lista. 🏆')
  }

  return (
    <section className="seccion-partidos">
      {/* ── Bloque A: crear torneo ── */}
      <div className="partidos-bloque">
        <div className="landing-header-flex partidos-encabezado">
          <div>
            <span className="sub-tag">Organizar torneo</span>
            <h2 className="landing-title">Crea tu torneo</h2>
          </div>
          {sedeNombre && (
            <p className="landing-desc-side">
              Define los cupos, las fechas y el premio. Los equipos se inscriben directamente aquí, en {sedeNombre}.
            </p>
          )}
        </div>

        {!autenticado ? (
          <p className="partidos-aviso">Necesitas iniciar sesión para crear un torneo.</p>
        ) : !esAdmin ? (
          <div className="partidos-aviso torneo-aviso-jugador">
            <strong>🏆 Los torneos los organiza la sede</strong>
            <p>
              Solo el administrador de {sedeNombre ?? 'la sede'} puede crear torneos.
              Puedes inscribir tu equipo en cualquier torneo de la lista que tenga cupos disponibles.
            </p>
          </div>
        ) : (
          <form className="form-partido" onSubmit={publicar} noValidate>
            <label className="form-partido-completo">
              Nombre del torneo
              <input
                className="input-moderno"
                maxLength={120}
                value={form.nombre}
                onChange={cambiar('nombre')}
                placeholder="Copa Relámpago de Octubre"
              />
            </label>

            <label>
              Modalidad
              <select className="input-moderno" value={form.modalidad} onChange={cambiar('modalidad')}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label>
              Equipos (4 a 12)
              <input
                type="number" className="input-moderno" min={4} max={12}
                value={form.cupos} onChange={cambiar('cupos')}
              />
            </label>

            <label>
              Fecha de inicio
              <input type="date" className="input-moderno" min={hoy} value={form.fechaInicio} onChange={cambiar('fechaInicio')} />
            </label>

            <label>
              Cierre de inscripciones
              <input
                type="date" className="input-moderno" min={hoy} max={form.fechaInicio || undefined}
                value={form.cierre} onChange={cambiar('cierre')}
              />
            </label>

            <label className="form-partido-completo">
              Premio
              <input
                className="input-moderno"
                maxLength={200}
                value={form.premio}
                onChange={cambiar('premio')}
                placeholder="Trofeo + $500.000"
              />
            </label>

            <label className="form-partido-completo">
              Descripción
              <textarea
                className="input-moderno"
                rows={3}
                value={form.descripcion}
                onChange={cambiar('descripcion')}
                placeholder="Formato, reglas, horarios de los partidos…"
              />
            </label>

            {errorForm && (
              <p className="form-partido-completo partidos-error" role="alert">{errorForm}</p>
            )}

            <button type="submit" className="btn-cta-primary form-partido-completo" disabled={publicando}>
              {publicando ? 'Creando…' : 'Crear torneo'}
            </button>
          </form>
        )}
      </div>

      {/* ── Bloque B: lista ── */}
      <div className="partidos-bloque">
        <h2 className="landing-title">Torneos de la sede</h2>

        {cargando ? (
          <Cargando texto="Cargando torneos" />
        ) : errorLista ? (
          <div className="partidos-aviso">
            <p className="partidos-error">{errorLista}</p>
            <button type="button" className="btn-cta-primary" onClick={recargar}>
              Reintentar
            </button>
          </div>
        ) : torneos.length === 0 ? (
          <p className="partidos-aviso">Todavía no hay torneos en esta sede.</p>
        ) : (
          <div className="grid-canchas grid-partidos">
            {torneos.map((t) => (
              <TarjetaTorneo
                key={t.id}
                torneo={t}
                autenticado={autenticado}
                administra={administra}
                onInscrito={recargar}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
