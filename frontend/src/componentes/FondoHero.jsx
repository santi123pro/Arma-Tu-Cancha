import { useEffect, useRef } from 'react'

// Fondo animado del hero: puntos ("jugadores") que se mueven y se conectan
// entre sí, y que se enganchan al cursor con líneas verdes. Encima, un
// reflector que sigue el mouse. Con "reducir movimiento" no se dibuja nada.
const DISTANCIA_ENLACE = 130
const RADIO_MOUSE = 180

const COLORES = {
  oscuro: { punto: 'rgba(203,213,225,.5)', linea: '148,163,184', cerca: '74,222,128' },
  claro: { punto: 'rgba(15,23,42,.32)', linea: '15,23,42', cerca: '22,163,74' },
}

export default function FondoHero() {
  const canvasRef = useRef(null)
  const reflectorRef = useRef(null)

  useEffect(function () {
    const canvas = canvasRef.current
    const reflector = reflectorRef.current
    const seccion = canvas.closest('section')
    if (!seccion || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    const mouse = { x: 0, y: 0, activo: false }
    let puntos = []
    let ancho = 0
    let alto = 0
    let visible = true
    let frame = 0

    function crearPuntos() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      ancho = seccion.clientWidth
      alto = seccion.clientHeight
      canvas.width = ancho * dpr
      canvas.height = alto * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cantidad = Math.round(Math.min(80, (ancho * alto) / 17000))
      puntos = Array.from({ length: cantidad }, () => ({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.9,
      }))
    }

    function dibujar() {
      const c = COLORES[document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro']
      const alcance = RADIO_MOUSE * 1.3
      ctx.clearRect(0, 0, ancho, alto)

      for (const p of puntos) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > ancho) p.vx *= -1
        if (p.y < 0 || p.y > alto) p.vy *= -1
        if (mouse.activo) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d = Math.hypot(dx, dy)
          if (d > 0 && d < RADIO_MOUSE) {
            const empuje = (1 - d / RADIO_MOUSE) * 1.2
            p.x += (dx / d) * empuje
            p.y += (dy / d) * empuje
          }
        }
      }

      for (let i = 0; i < puntos.length; i++) {
        const a = puntos[i]
        for (let j = i + 1; j < puntos.length; j++) {
          const b = puntos[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < DISTANCIA_ENLACE) {
            ctx.strokeStyle = `rgba(${c.linea},${(1 - d / DISTANCIA_ENLACE) * 0.2})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
        if (mouse.activo) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y)
          if (d < alcance) {
            ctx.strokeStyle = `rgba(${c.cerca},${(1 - d / alcance) * 0.7})`
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
        }
      }

      for (const p of puntos) {
        const cerca = mouse.activo && Math.hypot(p.x - mouse.x, p.y - mouse.y) < alcance
        ctx.fillStyle = cerca ? `rgb(${c.cerca})` : c.punto
        ctx.beginPath()
        ctx.arc(p.x, p.y, cerca ? p.r + 0.9 : p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function ciclo() {
      dibujar()
      frame = visible ? requestAnimationFrame(ciclo) : 0
    }

    crearPuntos()
    frame = requestAnimationFrame(ciclo)

    // Solo se recalcula si cambia el ancho: en el celular la barra del
    // navegador cambia el alto al hacer scroll y no queremos reiniciar.
    let ultimoAncho = ancho
    function alRedimensionar() {
      if (seccion.clientWidth !== ultimoAncho) {
        ultimoAncho = seccion.clientWidth
        crearPuntos()
      }
    }
    addEventListener('resize', alRedimensionar)

    // Se pausa cuando el hero no está en pantalla, para no gastar batería.
    const observador = new IntersectionObserver(function ([entrada]) {
      visible = entrada.isIntersecting
      if (visible && !frame) frame = requestAnimationFrame(ciclo)
    })
    observador.observe(seccion)

    function alMover(e) {
      const r = seccion.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
      mouse.activo = true
      reflector.style.setProperty('--rx', `${mouse.x}px`)
      reflector.style.setProperty('--ry', `${mouse.y}px`)
      reflector.classList.add('activo')
    }
    function alSalir() {
      mouse.activo = false
      reflector.classList.remove('activo')
    }
    // Solo con mouse: en pantallas táctiles los puntos se mueven solos.
    const conMouse = matchMedia('(pointer: fine)').matches
    if (conMouse) {
      seccion.addEventListener('pointermove', alMover)
      seccion.addEventListener('pointerleave', alSalir)
    }

    return function () {
      cancelAnimationFrame(frame)
      observador.disconnect()
      removeEventListener('resize', alRedimensionar)
      seccion.removeEventListener('pointermove', alMover)
      seccion.removeEventListener('pointerleave', alSalir)
    }
  }, [])

  return (
    <div className="hero-fondo" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-fondo-red" />
      <div ref={reflectorRef} className="hero-fondo-reflector" />
    </div>
  )
}
