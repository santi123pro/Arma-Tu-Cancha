import { useEffect, useState } from 'react'
import { hoyLocal } from '../lib/formato'
import {
  canchasDeSede, contactosMisPartidos, crearPartido, disponibilidad, partidosBuscandoJugadores,
  salirDePartido, unirseAPartido,
} from '../lib/datos'
import { useSesion } from '../lib/useSesion'
import { useToast } from '../componentes/Toast'
import Cargando from '../componentes/Cargando'
import SelectorHora from '../componentes/SelectorHora'
import { JugadoresDelPartido, OrganizadorDelPartido } from '../componentes/ContactosPartido'
import { balonazo } from '../lib/balonazo'

const MODALIDADES = ['Fútbol 5', 'Fútbol 6', 'Fútbol 7', 'Fútbol 8', 'Fútbol 11']

// El value va en minúscula exacta: es lo que acepta el CHECK de nivel.
const NIVELES = [
  { valor: 'todos', etiqueta: 'Todos los niveles' },
  { valor: 'principiante', etiqueta: 'Principiante' },
  { valor: 'intermedio', etiqueta: 'Intermedio' },
  { valor: 'avanzado', etiqueta: 'Avanzado' },
]

const POSICIONES = ['Arquero', 'Defensa', 'Mediocampista', 'Delantero']

const FORM_VACIO = {
  canchaId: '',
  fecha: '',
  hora: '',
  modalidad: 'Fútbol 6',
  nivel: 'todos',
  posicion: '',
  cupos: '',
}


// '2026-10-05' + '19:00:00' → 'domingo 5 de octubre · 7:00 p. m.'
function fechaLegible(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const momento = new Date(a, m - 1, d, h, min)
  const dia = momento.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const reloj = momento.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  return `${dia} · ${reloj}`
}

// '15:00:00' → '3:00 PM', igual que en la reserva de canchas.
function hora12(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Hora actual 'HH:MM:SS' del reloj local, para descartar franjas pasadas.
function horaActual() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

// Filas de contactos_mis_partidos → Map(partido_id → [contactos])
function agruparContactos(filas) {
  const mapa = new Map()
  for (const f of filas ?? []) {
    if (!mapa.has(f.partido_id)) mapa.set(f.partido_id, [])
    mapa.get(f.partido_id).push(f)
  }
  return mapa
}

function etiquetaNivel(valor) {
  return NIVELES.find((n) => n.valor === valor)?.etiqueta ?? valor
}

export default function Partidos({ sedeId, sedeNombre }) {
  const { autenticado, usuario } = useSesion()
  const toast = useToast()
  const hoy = hoyLocal()

  const [canchas, setCanchas] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorLista, setErrorLista] = useState(null)
  const [recarga, setRecarga] = useState(0)
  // Partido en el que se está uniendo o saliendo, para bloquear su botón.
  const [ocupado, setOcupado] = useState(null)
  // Nombre y celular de la otra parte en mis partidos, por partido_id.
  const [contactos, setContactos] = useState({ porPartido: new Map(), error: null })

  // Canchas del desplegable: se recargan al cambiar de sede y se limpia
  // la que estuviera elegida, porque ya no pertenece a esta sede.
  useEffect(() => {
    let vigente = true
    setForm((f) => ({ ...f, canchaId: '', hora: '' }))
    canchasDeSede(sedeId).then(({ datos }) => {
      if (vigente) setCanchas(datos ?? [])
    })
    return () => { vigente = false }
  }, [sedeId])

  // Horas de inicio: las mismas franjas de una hora que ofrece la reserva
  // de esa cancha (de la apertura al cierre de la sede). No se filtran las
  // reservadas, porque quien publica el partido suele ser quien reservó.
  // clave = cancha|fecha de la consulta que trajo esas franjas.
  const [franjas, setFranjas] = useState({ clave: null, lista: [] })
  const claveFranjas = form.canchaId && form.fecha ? `${form.canchaId}|${form.fecha}` : null

  useEffect(() => {
    if (!claveFranjas) return
    let vigente = true
    const [canchaId, fecha] = claveFranjas.split('|')
    disponibilidad(Number(canchaId), fecha).then(({ datos }) => {
      if (vigente) setFranjas({ clave: claveFranjas, lista: datos ?? [] })
    })
    return () => { vigente = false }
  }, [claveFranjas])

  const cargandoFranjas = claveFranjas !== null && franjas.clave !== claveFranjas
  const ahora = horaActual()
  const horasDisponibles = cargandoFranjas || !claveFranjas
    ? []
    : franjas.lista.filter((f) => form.fecha !== hoy || f.hora_inicio > ahora)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setErrorLista(null)
    Promise.all([
      partidosBuscandoJugadores(sedeId, hoy),
      autenticado ? contactosMisPartidos() : Promise.resolve({ datos: [], error: null }),
    ]).then(([lista, contactos]) => {
      if (!vigente) return
      if (lista.error) setErrorLista(lista.error)
      else setPartidos(lista.datos ?? [])
      // Si fallan los contactos, el listado igual se muestra.
      setContactos({ porPartido: agruparContactos(contactos.datos), error: contactos.error })
      setCargando(false)
    })
    return () => { vigente = false }
  }, [sedeId, hoy, recarga, autenticado])

  function cambiar(campo) {
    return (e) => setForm((f) => ({
      ...f,
      [campo]: e.target.value,
      // Otra cancha u otra fecha tienen otras franjas: la hora elegida ya no vale.
      ...(campo === 'canchaId' || campo === 'fecha' ? { hora: '' } : {}),
    }))
  }

  async function publicar(e) {
    e.preventDefault()
    if (publicando) return
    setErrorForm(null)

    const cupos = Number(form.cupos)
    if (!form.canchaId) return setErrorForm('Selecciona la cancha.')
    if (!form.fecha || form.fecha < hoy) return setErrorForm('Elige una fecha de hoy en adelante.')
    if (!form.hora) return setErrorForm('Selecciona la hora de inicio.')
    // Uno de los cupos es el de quien lo arma (migración 0016).
    if (!Number.isInteger(cupos) || cupos < 2 || cupos > 22) {
      return setErrorForm('Los cupos deben estar entre 2 y 22 (contándote a ti).')
    }

    setPublicando(true)
    const { error } = await crearPartido({
      canchaId: Number(form.canchaId),
      fecha: form.fecha,
      hora: form.hora,
      modalidad: form.modalidad,
      nivel: form.nivel,
      posicionRequerida: form.posicion || null,
      cuposTotales: cupos,
    })
    setPublicando(false)

    if (error) {
      setErrorForm(error)
      toast(error, 'error')
      return
    }

    setForm(FORM_VACIO)
    setRecarga((n) => n + 1)
    await balonazo()
    toast('¡Partido publicado! Ya estás anotado y aparece en la lista.', 'success')
  }

  async function unirseAlPartido(p) {
    if (ocupado) return
    setOcupado(p.id)
    const { error } = await unirseAPartido(p.id, p.posicion_requerida)
    setOcupado(null)
    if (error) return toast(error, 'error')
    toast('¡Listo! Ya tienes un cupo en el partido.', 'success')
    setRecarga((n) => n + 1)
  }

  async function salirDelPartido(p) {
    if (ocupado) return
    setOcupado(p.id)
    const { error } = await salirDePartido(p.id)
    setOcupado(null)
    if (error) return toast(error, 'error')
    toast('Saliste del partido.')
    setRecarga((n) => n + 1)
  }

  const estoyEn = (p) => p.partido_jugadores?.some((j) => j.usuario_id === usuario?.id)
  const esMio = (p) => !!usuario && p.creador_id === usuario.id
  // Los completos solo se muestran a quien está anotado y a quien lo armó.
  const visibles = partidos.filter((p) => p.cupos_disponibles > 0 || estoyEn(p) || esMio(p))

  return (
    <section className="seccion-partidos">
      {/* ── Bloque A: publicar ── */}
      <div className="partidos-bloque">
        <div className="landing-header-flex partidos-encabezado">
          <div>
            <span className="sub-tag">Publicar partido abierto</span>
            <h2 className="landing-title">Arma tu partido</h2>
          </div>
          {sedeNombre && (
            <p className="landing-desc-side">
              ¿Te faltan jugadores? Publica tu partido en {sedeNombre} y deja que otros jugadores se unan.
            </p>
          )}
        </div>

        {!autenticado ? (
          <p className="partidos-aviso">Necesitas iniciar sesión para publicar un partido.</p>
        ) : (
          <form className="form-partido" onSubmit={publicar} noValidate>
            <label>
              Cancha
              <select className="input-moderno" value={form.canchaId} onChange={cambiar('canchaId')}>
                <option value="">Selecciona la cancha</option>
                {canchas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </label>

            <label>
              Fecha del partido
              <input type="date" className="input-moderno" min={hoy} value={form.fecha} onChange={cambiar('fecha')} />
            </label>

            {/* Un div y no un label: dentro hay varios botones. */}
            <div className="form-partido-completo campo-hora">
              <div className="campo-hora-cabeza">
                <span id="etiqueta-hora">Hora de inicio</span>
                {form.hora && (
                  <small>
                    {hora12(form.hora)} – {hora12(horasDisponibles.find((f) => f.hora_inicio === form.hora)?.hora_fin ?? form.hora)}
                  </small>
                )}
              </div>
              <SelectorHora
                idEtiqueta="etiqueta-hora"
                opciones={horasDisponibles}
                valor={form.hora}
                onCambio={(hora) => setForm((f) => ({ ...f, hora }))}
                aviso={
                  !form.canchaId || !form.fecha
                    ? 'Elige primero la cancha y la fecha para ver los horarios.'
                    : cargandoFranjas
                      ? 'Cargando horarios…'
                      : horasDisponibles.length === 0
                        ? 'No hay horarios disponibles para esta fecha. Prueba con otra.'
                        : null
                }
              />
            </div>


            <label>
              Modalidad
              <select className="input-moderno" value={form.modalidad} onChange={cambiar('modalidad')}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label>
              Nivel requerido
              <select className="input-moderno" value={form.nivel} onChange={cambiar('nivel')}>
                {NIVELES.map((n) => <option key={n.valor} value={n.valor}>{n.etiqueta}</option>)}
              </select>
            </label>

            <label>
              Posición buscada
              <select className="input-moderno" value={form.posicion} onChange={cambiar('posicion')}>
                <option value="">Cualquier posición</option>
                {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label>
              Cupos totales (contándote a ti)
              <input
                type="number" className="input-moderno" min={2} max={22}
                value={form.cupos} onChange={cambiar('cupos')}
              />
            </label>

            {errorForm && (
              <p className="form-partido-completo partidos-error" role="alert">{errorForm}</p>
            )}

            <button type="submit" className="btn-cta-primary form-partido-completo" disabled={publicando}>
              {publicando ? 'Publicando…' : 'Publicar partido'}
            </button>
          </form>
        )}
      </div>

      {/* ── Bloque B: lista ── */}
      <div className="partidos-bloque">
        <h2 className="landing-title">Partidos buscando jugadores</h2>

        {cargando ? (
          <Cargando texto="Cargando partidos" />
        ) : errorLista ? (
          <div className="partidos-aviso">
            <p className="partidos-error">{errorLista}</p>
            <button type="button" className="btn-cta-primary" onClick={() => setRecarga((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="partidos-aviso">Por ahora no hay partidos buscando jugadores.</p>
        ) : (
          <div className="grid-canchas grid-partidos">
            {visibles.map((p) => (
              <article key={p.id} className={'tarjeta-cancha' + (esMio(p) ? ' tarjeta-partido-mio' : '')}>
                <div className="partido-cabeza">
                  <h3>{p.canchas?.nombre}</h3>
                  {esMio(p) && <span className="partido-mio-etiqueta">Tu partido</span>}
                </div>
                <p className="partido-fecha">{fechaLegible(p.fecha, p.hora_inicio)}</p>
                <p><strong>Modalidad:</strong> {p.modalidad}</p>
                <p><strong>Nivel:</strong> {etiquetaNivel(p.nivel)}</p>
                <p><strong>Posición buscada:</strong> {p.posicion_requerida ?? 'Cualquier posición'}</p>
                <div className="partido-cupos">
                  <p><span>{p.cupos_disponibles}</span> de {p.cupos_totales} cupos libres</p>
                  <div className="partido-barra">
                    <i style={{ width: `${(1 - p.cupos_disponibles / p.cupos_totales) * 100}%` }} />
                  </div>
                </div>

                {esMio(p) ? (
                  <JugadoresDelPartido
                    contactos={contactos.porPartido.get(p.id) ?? []}
                    error={contactos.error}
                    resumen={`${fechaLegible(p.fecha, p.hora_inicio)} en ${p.canchas?.nombre}`}
                  />
                ) : estoyEn(p) && (
                  <OrganizadorDelPartido
                    contacto={contactos.porPartido.get(p.id)?.[0]}
                    error={contactos.error}
                    resumen={`${fechaLegible(p.fecha, p.hora_inicio)} en ${p.canchas?.nombre}`}
                  />
                )}

                {!autenticado ? (
                  <p className="torneo-nota">Inicia sesión para unirte.</p>
                ) : esMio(p) ? (
                  // Quien lo arma queda anotado al crearlo (migración 0016).
                  <p className="torneo-nota">✅ Armaste este partido y ya tienes tu cupo.</p>
                ) : estoyEn(p) ? (
                  <>
                    <p className="torneo-nota">✅ Ya tienes un cupo en este partido.</p>
                    <button
                      type="button" className="btn-torneo-cancelar"
                      onClick={() => salirDelPartido(p)} disabled={ocupado === p.id}
                    >
                      {ocupado === p.id ? 'Saliendo…' : 'Salir del partido'}
                    </button>
                  </>
                ) : p.cupos_disponibles === 0 ? (
                  <p className="torneo-nota">El partido está completo.</p>
                ) : (
                  <button
                    type="button" className="btn-cta-primary"
                    onClick={() => unirseAlPartido(p)} disabled={ocupado === p.id}
                  >
                    {ocupado === p.id ? 'Uniéndote…' : 'Unirme al partido'}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
