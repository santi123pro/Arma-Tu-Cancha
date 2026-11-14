import { useEffect, useMemo, useRef, useState } from 'react'
import { svgToki } from '../lib/tokiSvg'

// ---------------------------------------------------------------------
// Toki, el compañero que acompaña al jugador por la app.
//
// · Al entrar a cada pantalla dice lo que se puede hacer ahí (GUION).
//   Tocarlo da el siguiente consejo de esa pantalla.
// · Las acciones lo cambian con avisarToki() (lib/toki.js): reserva
//   apartada, pago, confirmación, errores…
// · Sigue el dedo o el cursor con la mirada, respira, parpadea y, si
//   nadie lo toca, de vez en cuando hace un gesto (salta, baila, patea…).
// · "Esconder" lo deja asomado en la esquina; tocarlo lo trae de vuelta.
// · Con "reducir movimiento" del sistema se queda quieto (estilos.css).
// ---------------------------------------------------------------------

// Por pantalla: [gesto, frase]. La primera sale al entrar.
const GUION = {
  portada: [
    ['saluda', '¡Hola! Soy Toki. Aquí reservas cancha en Cali sin llamar a nadie.'],
    ['senala', 'Baja y mira las sedes en el mapa: toca una para ver sus canchas.'],
    ['pulgar', 'Crea tu cuenta gratis y reserva en menos de un minuto.'],
  ],
  login: [
    ['saluda', 'Entra con tu correo, tu celular o con Google.'],
    ['senala', '¿Primera vez? Toca "Registrarme" arriba del formulario.'],
    ['piensa', '¿Olvidaste la clave? Te ayudo a crear una nueva.'],
  ],
  gracias: [['celebra', '¡Bienvenido al equipo! Revisa tu correo para activar la cuenta.']],
  bienvenida: [
    ['celebra', '¡Ya eres parte del equipo!'],
    ['senala', 'Empieza eligiendo una sede para ver sus horarios.'],
  ],
  marketplace: [
    ['senala', 'Toca una sede para ver sus canchas y horarios libres.'],
    ['piensa', 'Cada tarjeta muestra a qué hora abre y cuántas canchas tiene.'],
    ['pulgar', 'Desde la sede también puedes unirte a partidos y torneos.'],
  ],
  sede: [
    ['senala', 'Elige el día en el calendario y toca un horario libre.'],
    ['espera', 'Al reservar te guardo la cancha 10 minutos mientras pagas con el QR.'],
    ['piensa', 'Arriba tienes las pestañas de partidos y torneos de esta sede.'],
  ],
  'sede-reservas': [
    ['senala', 'Aquí ves las reservas que tienes en esta sede.'],
    ['piensa', 'Si no puedes ir, cancela a tiempo para liberar el horario.'],
  ],
  partidos: [
    ['patea', '¿Te falta gente? Únete a un partido abierto.'],
    ['senala', 'O publica el tuyo: di cuántos jugadores faltan y a qué hora.'],
    ['pulgar', 'Cuando te unes ves el contacto del organizador.'],
  ],
  torneos: [
    ['celebra', 'Inscribe a tu equipo en un torneo de esta sede.'],
    ['piensa', 'Revisa el premio, la fecha y los cupos antes de inscribirte.'],
  ],
  'mis-reservas': [
    ['senala', 'Aquí están todas tus reservas, próximas y pasadas.'],
    ['espera', 'Las que dicen "pendiente" esperan que la sede confirme tu pago.'],
    ['piensa', 'Si no puedes ir, cancela para que otro aproveche la cancha.'],
  ],
  'mi-cuenta': [
    ['saluda', 'Aquí cambias tu foto, tus datos y tu privacidad.'],
    ['piensa', 'Activa la verificación en dos pasos para proteger tu cuenta.'],
  ],
  aliados: [
    ['pulgar', '¿Tienes una sede? Súmala y recibe reservas sin llamadas.'],
    ['senala', 'Llena el formulario y te contactamos.'],
  ],
  privacidad: [['piensa', 'Aquí te contamos qué datos guardamos y para qué.']],
  terminos: [['piensa', 'Estas son las reglas para reservar y usar la app.']],
  'no-encontrada': [['sorpresa', '¡Uy! Esta página no existe. Vuelve al inicio desde el menú.']],
}

// Gestos que hace solo cuando nadie lo toca.
const TRUCOS = ['baila', 'patea', 'pulgar', 'sorpresa', 'salto', 'giro']
const CLAVE_ESCONDIDO = 'toki-escondido'
const DURACION_GLOBO = 9000
const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function leer(clave) {
  try { return window.localStorage.getItem(clave) } catch { return null }
}
function guardar(clave, valor) {
  try { window.localStorage.setItem(clave, valor) } catch { /* modo privado */ }
}
const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]

export default function Toki({ pantalla, conBarra = false }) {
  const guion = GUION[pantalla] ?? []
  const [base] = guion[0] ?? ['saluda']
  // App lo monta con key={pantalla}: cada pantalla empieza con su primera frase.
  const [indice, setIndice] = useState(0)
  const [globo, setGlobo] = useState(() => guion[0]?.[1] ?? '')
  const [gesto, setGesto] = useState(null) // { estado, id, duracion } de un aviso o un toque
  const [truco, setTruco] = useState(null) // salto / giro: movimiento sin cambiar el dibujo
  const [escondido, setEscondido] = useState(() => leer(CLAVE_ESCONDIDO) === '1')
  const [quieto, setQuieto] = useState(0) // cambia con cada interacción para reiniciar el reloj de trucos
  const caja = useRef(null)

  // Avisos de la app (reserva, pago, errores…).
  useEffect(() => {
    function alAviso(e) {
      const { estado, mensaje, duracion } = e.detail ?? {}
      if (!estado) return
      setGesto({ estado, id: Date.now(), duracion })
      setGlobo(mensaje || '')
      setQuieto(Date.now())
    }
    window.addEventListener('toki', alAviso)
    return () => window.removeEventListener('toki', alAviso)
  }, [])

  // El gesto dura un rato y vuelve al de la pantalla.
  useEffect(() => {
    if (!gesto) return undefined
    const t = setTimeout(() => setGesto(null), gesto.duracion ?? 6000)
    return () => clearTimeout(t)
  }, [gesto])

  // El globo se cierra solo.
  useEffect(() => {
    if (!globo) return undefined
    const t = setTimeout(() => setGlobo(''), DURACION_GLOBO)
    return () => clearTimeout(t)
  }, [globo])

  // Si nadie lo toca, cada tanto hace un truco.
  useEffect(() => {
    if (escondido || gesto || truco || sinMovimiento()) return undefined
    const t = setTimeout(() => {
      const elegido = alAzar(TRUCOS)
      if (elegido === 'salto' || elegido === 'giro') setTruco(elegido)
      else setGesto({ estado: elegido, id: Date.now(), duracion: 3200 })
    }, 14000 + Math.random() * 10000)
    return () => clearTimeout(t)
  }, [escondido, gesto, truco, quieto])

  useEffect(() => {
    if (!truco) return undefined
    const t = setTimeout(() => setTruco(null), 1100)
    return () => clearTimeout(t)
  }, [truco])

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

  const estado = gesto?.estado ?? base
  const dibujo = useMemo(() => svgToki(estado, { ancho: 260 }), [estado])

  // Tocarlo: si está escondido vuelve; si no, da el siguiente consejo.
  function tocar() {
    setQuieto(Date.now())
    if (escondido) {
      setEscondido(false)
      guardar(CLAVE_ESCONDIDO, '0')
      setGlobo(guion[indice]?.[1] ?? '')
      setGesto({ estado: 'saluda', id: Date.now(), duracion: 2500 })
      return
    }
    if (!guion.length) {
      setTruco('salto')
      return
    }
    const siguiente = globo ? (indice + 1) % guion.length : indice
    const [gestoFrase, frase] = guion[siguiente]
    setIndice(siguiente)
    setGlobo(frase)
    setGesto({ estado: gestoFrase, id: Date.now(), duracion: DURACION_GLOBO })
  }

  function esconder() {
    setEscondido(true)
    setGlobo('')
    setGesto(null)
    guardar(CLAVE_ESCONDIDO, '1')
  }

  const clases = ['toki-widget']
  if (conBarra) clases.push('toki-con-barra')
  if (escondido) clases.push('toki-escondido')

  return (
    <div className={clases.join(' ')}>
      {globo && !escondido && (
        <div className="toki-globo" role="status" aria-live="polite">
          <p>{globo}</p>
          <div className="toki-globo-acciones">
            {guion.length > 1 && <span className="toki-globo-pista">Tócame para otro consejo</span>}
            <button type="button" className="toki-globo-esconder" onClick={esconder}>Esconder</button>
          </div>
          <button type="button" className="toki-globo-cerrar" onClick={() => setGlobo('')} aria-label="Cerrar mensaje de Toki">×</button>
        </div>
      )}
      <button
        type="button"
        ref={caja}
        className={'toki-boton' + (truco ? ` toki-truco-${truco}` : '')}
        onClick={tocar}
        aria-label={escondido ? 'Mostrar a Toki' : 'Pedirle un consejo a Toki'}
        title={escondido ? 'Mostrar a Toki' : 'Pedirle un consejo a Toki'}
      >
        {/* Dibujo propio y fijo (lib/tokiSvg.js): no lleva datos del usuario. */}
        <span key={estado} className="toki-dibujo" dangerouslySetInnerHTML={{ __html: dibujo }} />
      </button>
    </div>
  )
}
