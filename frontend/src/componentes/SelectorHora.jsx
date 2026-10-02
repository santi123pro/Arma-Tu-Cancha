import { useEffect, useRef, useState } from 'react'

// '15:00:00' → { reloj: '3:00', sufijo: 'PM' }
function partes(hora) {
  const [h, m] = hora.split(':').map(Number)
  return { reloj: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, sufijo: h < 12 ? 'AM' : 'PM' }
}

// Horas de inicio en una franja horizontal con scroll, en vez de un
// desplegable que muestra todas a la vez.
// opciones: [{ hora_inicio, hora_fin }]   valor: 'HH:MM:SS' o ''
export default function SelectorHora({ opciones, valor, onCambio, aviso, idEtiqueta }) {
  const pista = useRef(null)
  const [bordes, setBordes] = useState({ inicio: true, fin: true })

  function medir() {
    const el = pista.current
    if (!el) return
    setBordes({
      inicio: el.scrollLeft <= 2,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    })
  }

  // Al cargar otras opciones: volver al inicio, o centrar la elegida.
  useEffect(() => {
    const el = pista.current
    if (!el) return
    const activa = el.querySelector('[aria-checked="true"]')
    if (activa) activa.scrollIntoView({ block: 'nearest', inline: 'center' })
    else el.scrollLeft = 0
    const cuadro = requestAnimationFrame(medir)
    return () => cancelAnimationFrame(cuadro)
  }, [opciones, valor])

  useEffect(() => {
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  function desplazar(sentido) {
    const el = pista.current
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  // Flechas del teclado dentro del grupo, como un grupo de radios.
  function teclado(e) {
    const i = opciones.findIndex((o) => o.hora_inicio === valor)
    let j = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(opciones.length - 1, i + 1)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1)
    if (e.key === 'Home') j = 0
    if (e.key === 'End') j = opciones.length - 1
    if (j === null) return
    e.preventDefault()
    onCambio(opciones[j].hora_inicio)
    pista.current?.querySelectorAll('[role="radio"]')[j]?.focus()
  }

  if (aviso) {
    return <p className="selector-hora-aviso">{aviso}</p>
  }

  return (
    <div className="selector-hora">
      <button
        type="button"
        className="selector-hora-flecha"
        onClick={() => desplazar(-1)}
        disabled={bordes.inicio}
        aria-label="Ver horas anteriores"
      >
        ‹
      </button>

      <div
        className={
          'selector-hora-marco' +
          (bordes.inicio ? '' : ' con-sombra-inicio') +
          (bordes.fin ? '' : ' con-sombra-fin')
        }
      >
        <div
          ref={pista}
          className="selector-hora-pista"
          role="radiogroup"
          aria-labelledby={idEtiqueta}
          onScroll={medir}
          onKeyDown={teclado}
        >
          {opciones.map((o, i) => {
            const elegida = o.hora_inicio === valor
            const { reloj, sufijo } = partes(o.hora_inicio)
            const fin = partes(o.hora_fin)
            // Solo una opción entra con Tab: la elegida, o la primera.
            const enfocable = elegida || (!valor && i === 0)
            return (
              <button
                key={o.hora_inicio}
                type="button"
                role="radio"
                aria-checked={elegida}
                aria-label={`${reloj} ${sufijo} a ${fin.reloj} ${fin.sufijo}`}
                tabIndex={enfocable ? 0 : -1}
                className={'selector-hora-opcion' + (elegida ? ' activa' : '')}
                onClick={() => onCambio(o.hora_inicio)}
              >
                <strong>{reloj}</strong>
                <span>{sufijo}</span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        className="selector-hora-flecha"
        onClick={() => desplazar(1)}
        disabled={bordes.fin}
        aria-label="Ver horas siguientes"
      >
        ›
      </button>
    </div>
  )
}
