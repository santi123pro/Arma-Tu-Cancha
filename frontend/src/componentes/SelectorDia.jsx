import { useMemo } from 'react'
import { fechaLocal } from '../lib/formato'
import { DIAS_ANTICIPACION } from '../lib/sedes'

const semana = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const completa = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

// '2026-11-03' como fecha local (new Date('2026-11-03') la leería en UTC).
function aFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

// Franja de días para elegir la fecha de todas las canchas de una sede.
export default function SelectorDia({ valor, onCambio }) {
  const dias = useMemo(
    () => Array.from({ length: DIAS_ANTICIPACION + 1 }, (_, i) => {
      const iso = fechaLocal(i)
      const fecha = aFecha(iso)
      return {
        iso,
        arriba: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : semana.format(fecha).replace('.', ''),
        numero: fecha.getDate(),
        nombre: completa.format(fecha),
      }
    }),
    [],
  )

  const elegido = dias.find((d) => d.iso === valor) ?? dias[0]

  return (
    <div className="selector-dia">
      <div className="selector-dia-pista" role="group" aria-label="Día de la reserva">
        {dias.map((d) => (
          <button
            key={d.iso}
            type="button"
            aria-pressed={d.iso === valor}
            aria-label={d.nombre}
            onClick={() => onCambio(d.iso)}
          >
            <span>{d.arriba}</span>
            <strong>{d.numero}</strong>
          </button>
        ))}
      </div>
      <p className="selector-dia-texto" aria-live="polite">Horarios del {elegido.nombre}</p>
    </div>
  )
}
