import { useEffect, useMemo, useRef, useState } from 'react'
import { svgToki } from '../lib/tokiSvg'

// ---------------------------------------------------------------------
// Toki, el compañero que acompaña al jugador por la app.
//
// · Cada pantalla tiene su gesto y, la primera vez en la sesión, un globo
//   con una frase corta (GUION).
// · Las acciones lo cambian con avisarToki() (lib/toki.js): reserva
//   apartada, pago, confirmación, errores…
// · Sigue el dedo o el cursor con la mirada, respira y parpadea.
// · Tocarlo lo esconde (queda asomado) y la preferencia se recuerda.
// · Con "reducir movimiento" del sistema se queda quieto (estilos.css).
// ---------------------------------------------------------------------

const GUION = {
  portada: ['saluda', '¡Hola! Soy Toki. ¿Jugamos hoy?'],
  login: ['saluda', 'Entra y te ayudo a encontrar cancha.'],
  gracias: ['celebra', '¡Bienvenido al equipo!'],
  bienvenida: ['celebra', '¡Ya eres parte del equipo!'],
  marketplace: ['senala', 'Toca una sede para ver sus horarios.'],
  sede: ['senala', 'Elige el día y toca un horario libre.'],
  partidos: ['saluda', '¿Te falta gente? Únete a un partido abierto.'],
  torneos: ['saluda', 'Inscribe a tu equipo en un torneo.'],
  'mis-reservas': ['saluda', 'Aquí tienes todas tus reservas.'],
  'mi-cuenta': ['saluda', ''],
  suelta: ['saluda', ''],
}

const CLAVE_ESCONDIDO = 'toki-escondido'

function leer(almacen, clave) {
  try { return window[almacen].getItem(clave) } catch { return null }
}
function guardar(almacen, clave, valor) {
  try { window[almacen].setItem(clave, valor) } catch { /* modo privado */ }
}

export default function Toki({ pantalla, conBarra = false }) {
  const [base, frase] = GUION[pantalla] ?? GUION.suelta
  const claveVisto = `toki-visto-${pantalla}`
  const [aviso, setAviso] = useState(null) // { estado, id, duracion }
  // App lo monta con key={pantalla}: cada pantalla empieza limpia y su
  // frase sale solo la primera vez en la sesión.
  const [globo, setGlobo] = useState(() => (frase && !leer('sessionStorage', claveVisto) ? frase : ''))
  const [escondido, setEscondido] = useState(() => leer('localStorage', CLAVE_ESCONDIDO) === '1')
  const caja = useRef(null)

  useEffect(() => {
    if (frase) guardar('sessionStorage', claveVisto, '1')
  }, [frase, claveVisto])

  // Avisos de la app (reserva, pago, errores…).
  useEffect(() => {
    function alAviso(e) {
      const { estado, mensaje, duracion } = e.detail ?? {}
      if (!estado) return
      setAviso({ estado, id: Date.now(), duracion })
      setGlobo(mensaje || '')
    }
    window.addEventListener('toki', alAviso)
    return () => window.removeEventListener('toki', alAviso)
  }, [])

  // El gesto del aviso dura un rato y vuelve al de la pantalla.
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), aviso.duracion ?? 6000)
    return () => clearTimeout(t)
  }, [aviso])

  // El globo se cierra solo.
  useEffect(() => {
    if (!globo) return undefined
    const t = setTimeout(() => setGlobo(''), 6500)
    return () => clearTimeout(t)
  }, [globo])

  // La mirada sigue el puntero (o el dedo).
  useEffect(() => {
    let cuadro = 0
    function mover(e) {
      if (cuadro) return
      cuadro = requestAnimationFrame(() => {
        cuadro = 0
        const svg = caja.current?.querySelector('svg')
        const mirada = svg?.querySelector('.toki-mirada')
        if (!svg || !mirada) return
        const r = svg.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height * 0.45)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 300)
        mirada.setAttribute('transform', `translate(${(dx / d * 4 * k).toFixed(1)} ${(dy / d * 3 * k).toFixed(1)})`)
      })
    }
    window.addEventListener('pointermove', mover, { passive: true })
    return () => { window.removeEventListener('pointermove', mover); cancelAnimationFrame(cuadro) }
  }, [])

  const estado = aviso?.estado ?? base
  const dibujo = useMemo(() => svgToki(estado, { ancho: 260 }), [estado])

  function alternar() {
    const nuevo = !escondido
    setEscondido(nuevo)
    setGlobo('')
    guardar('localStorage', CLAVE_ESCONDIDO, nuevo ? '1' : '0')
  }

  return (
    <div className={`toki-widget${conBarra ? ' toki-con-barra' : ''}${escondido ? ' toki-escondido' : ''}`}>
      {globo && !escondido && (
        <p className="toki-globo" role="status" aria-live="polite">
          {globo}
          <button type="button" className="toki-globo-cerrar" onClick={() => setGlobo('')} aria-label="Cerrar mensaje de Toki">×</button>
        </p>
      )}
      <button
        type="button"
        ref={caja}
        className="toki-boton"
        onClick={alternar}
        aria-label={escondido ? 'Mostrar a Toki' : 'Esconder a Toki'}
        title={escondido ? 'Mostrar a Toki' : 'Esconder a Toki'}
      >
        {/* Dibujo propio y fijo (lib/tokiSvg.js): no lleva datos del usuario. */}
        <span key={estado} className="toki-dibujo" dangerouslySetInnerHTML={{ __html: dibujo }} />
      </button>
    </div>
  )
}
