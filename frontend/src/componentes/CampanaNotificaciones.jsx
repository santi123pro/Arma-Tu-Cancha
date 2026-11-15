import { useEffect, useRef, useState } from 'react'
import Icono from './Icono'
import { useRecordatorios } from '../lib/useRecordatorios'

// '15:00:00' → '3:00 PM'
function hora12(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Encabezado humano del recordatorio.
function titular(r) {
  if (r.cuando === 'hoy') {
    const horas = Math.round(r.horasFaltan)
    if (r.horasFaltan <= 3) return '⚽ ¡Tu cancha es ya!'
    return `⚽ ¡Hoy juegas! En unas ${horas} horas`
  }
  if (r.cuando === 'manana') return '⚽ ¡Tu cancha es mañana!'
  return '⚽ Tu próxima cancha'
}

// Campana del header: avisa las canchas reservadas en las próximas horas.
export default function CampanaNotificaciones({ onIrAReservas }) {
  const { recordatorios, sinVer, marcarVistos } = useRecordatorios(true)
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)

  // Cerrar al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    function alClic(e) {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false)
    }
    function alTecla(e) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  function alternar() {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente) marcarVistos()
  }

  function irA(r) {
    setAbierto(false)
    onIrAReservas?.(r)
  }

  const etiqueta = sinVer > 0
    ? `Notificaciones, ${sinVer} sin ver`
    : 'Notificaciones'

  return (
    <div className="campana" ref={contenedor}>
      <button
        type="button"
        className="campana-boton"
        aria-label={etiqueta}
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={alternar}
      >
        <Icono nombre="campana" />
        {sinVer > 0 && (
          <span className="campana-punto" aria-hidden="true">{sinVer}</span>
        )}
      </button>

      {abierto && (
        <div className="campana-panel" role="dialog" aria-label="Notificaciones">
          <div className="campana-panel-cabeza">
            <strong>Notificaciones</strong>
          </div>

          {recordatorios.length === 0 ? (
            <p className="campana-vacio">
              No tienes canchas reservadas en las próximas 48 horas.
              <br />
              <small>Te avisaremos aquí cuando se acerque un partido.</small>
            </p>
          ) : (
            <ul className="campana-lista">
              {recordatorios.map((r) => (
                <li key={r.id}>
                  <button type="button" className="campana-item" onClick={() => irA(r)}>
                    <span className="campana-item-titulo">{titular(r)}</span>
                    <span className="campana-item-detalle">
                      {r.sede} · {hora12(r.horaInicio)}
                    </span>
                    <span className="campana-item-sub">
                      {r.cancha} · {r.cuando === 'hoy' ? 'hoy' : r.cuando === 'manana' ? 'mañana' : 'pronto'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
