import { useMemo, useState } from 'react'
import { fechaLocal } from '../lib/formato'
import { DIAS_ANTICIPACION } from '../lib/sedes'

const fmtMes = new Intl.DateTimeFormat('es-CO', { month: 'long' })
const fmtCompleta = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// '2026-11-03' como fecha local (new Date('2026-11-03') la leería en UTC).
function aFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}
function aIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sumarDias(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
// Semana de lunes a domingo, como se usa en Colombia.
function lunesDe(d) {
  return sumarDias(d, -((d.getDay() + 6) % 7))
}
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// Título del bloque visible: "Noviembre 2026" o "Nov – Dic 2026" si cruza de mes.
function titulo(dias) {
  const a = dias[0].fecha
  const b = dias[dias.length - 1].fecha
  if (a.getMonth() === b.getMonth()) return `${mayus(fmtMes.format(a))} ${a.getFullYear()}`
  const corto = (d) => mayus(fmtMes.format(d).slice(0, 3))
  return a.getFullYear() === b.getFullYear()
    ? `${corto(a)} – ${corto(b)} ${b.getFullYear()}`
    : `${corto(a)} ${a.getFullYear()} – ${corto(b)} ${b.getFullYear()}`
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={dir === 'izq' ? 'M15 5l-7 7 7 7' : dir === 'der' ? 'M9 5l7 7-7 7' : 'M5 9l7 7 7-7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Calendario semanal para elegir la fecha de todas las canchas de una sede.
// Muestra una semana; "Ver todo" despliega todas las semanas reservables.
export default function SelectorDia({ valor, onCambio }) {
  const { semanas, hoy, limite } = useMemo(() => {
    const hoy = fechaLocal(0)
    const limite = fechaLocal(DIAS_ANTICIPACION)
    const inicio = lunesDe(aFecha(hoy))
    const fin = aFecha(limite)
    const semanas = []
    for (let lunes = inicio; lunes <= fin; lunes = sumarDias(lunes, 7)) {
      semanas.push(
        Array.from({ length: 7 }, (_, i) => {
          const fecha = sumarDias(lunes, i)
          const iso = aIso(fecha)
          return { iso, fecha, numero: fecha.getDate(), activo: iso >= hoy && iso <= limite }
        }),
      )
    }
    return { semanas, hoy, limite }
  }, [])

  const indiceDe = (iso) => Math.max(0, semanas.findIndex((s) => s.some((d) => d.iso === iso)))
  const [semana, setSemana] = useState(() => indiceDe(valor))
  const [expandido, setExpandido] = useState(false)

  // El día elegido desde otro lado ("Ver mañana") debe quedar a la vista.
  const [valorPrevio, setValorPrevio] = useState(valor)
  if (valor !== valorPrevio) {
    setValorPrevio(valor)
    setSemana(indiceDe(valor))
  }

  const visibles = expandido ? semanas : [semanas[semana]]
  const elegido = aFecha(valor >= hoy && valor <= limite ? valor : hoy)

  const dia = (d) => {
    const clases = ['cal-dia']
    if (d.iso === hoy) clases.push('es-hoy')
    if (d.iso === valor) clases.push('elegido')
    return (
      <button
        key={d.iso}
        type="button"
        className={clases.join(' ')}
        disabled={!d.activo}
        aria-pressed={d.iso === valor}
        aria-label={mayus(fmtCompleta.format(d.fecha)) + (d.iso === hoy ? ', hoy' : '')}
        aria-current={d.iso === hoy ? 'date' : undefined}
        onClick={() => onCambio(d.iso)}
      >
        <span>{d.numero}</span>
      </button>
    )
  }

  return (
    <section className="selector-dia" aria-label="Día de la reserva">
      <header className="cal-cabecera">
        <h2 className="cal-titulo">{titulo(visibles.flat())}</h2>
        <div className="cal-controles">
          {valor !== hoy && (
            <button type="button" className="cal-hoy" onClick={() => onCambio(hoy)}>Hoy</button>
          )}
          {!expandido && (
            <>
              <button
                type="button"
                className="cal-flecha"
                aria-label="Semana anterior"
                disabled={semana === 0}
                onClick={() => setSemana((s) => s - 1)}
              >
                <Chevron dir="izq" />
              </button>
              <button
                type="button"
                className="cal-flecha"
                aria-label="Semana siguiente"
                disabled={semana === semanas.length - 1}
                onClick={() => setSemana((s) => s + 1)}
              >
                <Chevron dir="der" />
              </button>
            </>
          )}
          <button
            type="button"
            className="cal-flecha cal-expandir"
            aria-label={expandido ? 'Ver una semana' : 'Ver todas las fechas'}
            aria-expanded={expandido}
            onClick={() => setExpandido((e) => !e)}
          >
            <Chevron dir="abajo" />
          </button>
        </div>
      </header>

      <div className="cal-rejilla" role="group" aria-label="Fechas disponibles">
        {INICIALES.map((l, i) => (
          <span key={i} className={'cal-inicial' + (i >= 5 ? ' finde' : '')} aria-hidden="true">{l}</span>
        ))}
        {visibles.flat().map(dia)}
      </div>

      <p className="selector-dia-texto" aria-live="polite">{mayus(fmtCompleta.format(elegido))}</p>
    </section>
  )
}
