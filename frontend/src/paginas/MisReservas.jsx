import { useEffect, useState } from 'react'
import { cancelarReserva, misReservasEnSede } from '../lib/datos'
import { useToast } from '../componentes/Toast'
import Cargando from '../componentes/Cargando'

// Los valores son los que acepta el CHECK reservas_estado_valido.
const ESTADOS = {
  confirmada: { texto: 'Confirmada', clase: 'estado-abierto' },
  pendiente: { texto: 'Pendiente', clase: 'estado-cerrado' },
  completada: { texto: 'Jugada', clase: 'estado-curso' },
  cancelada: { texto: 'Cancelada', clase: 'estado-fin' },
  no_asistio: { texto: 'No asistió', clase: 'estado-fin' },
}

// cancelar_reserva rechaza a un jugador si faltan menos de 24 horas.
const HORAS_MINIMAS_CANCELAR = 24

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

// Fecha y hora de la reserva en hora local del navegador.
function inicioReserva(r) {
  const [a, m, d] = r.fecha.split('-').map(Number)
  const [h, min] = r.hora_inicio.split(':').map(Number)
  return new Date(a, m - 1, d, h, min)
}

// '2026-10-05' → 'dom 5 de oct'
function fechaCorta(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

// '15:00:00' → '3:00 PM'
function hora12(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function esProxima(r) {
  return (r.estado === 'confirmada' || r.estado === 'pendiente') && inicioReserva(r) > new Date()
}

function TarjetaReserva({ reserva, conSede, onCancelada }) {
  const toast = useToast()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const estado = ESTADOS[reserva.estado] ?? { texto: reserva.estado, clase: 'estado-fin' }
  const proxima = esProxima(reserva)
  const horasFaltan = (inicioReserva(reserva) - new Date()) / 3600000
  const puedeCancelar = proxima && horasFaltan >= HORAS_MINIMAS_CANCELAR

  async function cancelar() {
    if (enviando) return
    setEnviando(true)
    const { error } = await cancelarReserva(reserva.id)
    setEnviando(false)

    if (error) {
      toast(error, 'error')
      return
    }

    toast('Reserva cancelada.')
    setConfirmando(false)
    onCancelada()
  }

  return (
    <article className={'tarjeta-cancha tarjeta-reserva' + (proxima ? '' : ' reserva-pasada')}>
      <div className="torneo-cabeza">
        <h3>{reserva.canchas?.nombre ?? 'Cancha'}</h3>
        <span className={'torneo-estado ' + estado.clase}>{estado.texto}</span>
      </div>

      {conSede && reserva.canchas?.sedes?.nombre && (
        <p className="reserva-sede">🏟️ {reserva.canchas.sedes.nombre}</p>
      )}
      <p className="partido-fecha">📅 {fechaCorta(reserva.fecha)}</p>

      <div className="torneo-datos">
        <span>🕒 {hora12(reserva.hora_inicio)} – {hora12(reserva.hora_fin)}</span>
        {reserva.canchas?.tipo && <span>⚽ {reserva.canchas.tipo}</span>}
        <span>💵 {pesos.format(reserva.precio_total)}</span>
      </div>

      <p className="reserva-codigo">
        Código <strong>{reserva.codigo}</strong>
      </p>

      {!proxima ? null : !puedeCancelar ? (
        <p className="torneo-nota">
          Faltan menos de 24 horas. Para cancelar, comunícate con la sede.
        </p>
      ) : confirmando ? (
        <div className="torneo-inscribir-botones">
          <button type="button" className="btn-torneo-cancelar" onClick={() => setConfirmando(false)}>
            No, mantener
          </button>
          <button type="button" className="btn-reserva-cancelar" onClick={cancelar} disabled={enviando}>
            {enviando ? 'Cancelando…' : 'Sí, cancelar'}
          </button>
        </div>
      ) : (
        <button type="button" className="btn-torneo-cancelar" onClick={() => setConfirmando(true)}>
          Cancelar reserva
        </button>
      )}
    </article>
  )
}

// Sin sedeId: las reservas del jugador en todas las sedes.
export default function MisReservas({ sedeId = null, sedeNombre }) {
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    misReservasEnSede(sedeId).then(({ datos, error }) => {
      if (!vigente) return
      setError(error ?? null)
      if (!error) setReservas(datos ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [sedeId, recarga])

  function recargar() {
    setCargando(true)
    setRecarga((n) => n + 1)
  }

  // Llegan de la más nueva a la más vieja; las próximas se muestran en
  // orden cronológico (la más cercana primero).
  const proximas = reservas.filter(esProxima).reverse()
  const historial = reservas.filter((r) => !esProxima(r))

  function lista(items, vacio) {
    if (cargando) return <Cargando texto="Cargando reservas" />
    if (error) {
      return (
        <div className="partidos-aviso">
          <p className="partidos-error">{error}</p>
          <button type="button" className="btn-cta-primary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )
    }
    if (items.length === 0) return <p className="partidos-aviso">{vacio}</p>
    return (
      <div className="grid-canchas grid-partidos">
        {items.map((r) => <TarjetaReserva key={r.id} reserva={r} conSede={!sedeId} onCancelada={recargar} />)}
      </div>
    )
  }

  return (
    <section className="seccion-partidos">
      {/* ── Bloque A: próximas ── */}
      <div className="partidos-bloque">
        <div className="landing-header-flex partidos-encabezado">
          <div>
            <span className="sub-tag">Lo que viene</span>
            <h2 className="landing-title">Próximas reservas</h2>
          </div>
          <p className="landing-desc-side">
            Puedes cancelar sin costo hasta 24 horas antes del partido.
          </p>
        </div>
        {lista(proximas, sedeId
          ? `No tienes reservas próximas en ${sedeNombre ?? 'esta sede'}.`
          : 'No tienes reservas próximas en ninguna sede.')}
      </div>

      {/* ── Bloque B: historial ── */}
      <div className="partidos-bloque">
        <h2 className="landing-title">Historial</h2>
        {lista(historial, 'Aquí aparecerán tus reservas pasadas y canceladas.')}
      </div>
    </section>
  )
}
