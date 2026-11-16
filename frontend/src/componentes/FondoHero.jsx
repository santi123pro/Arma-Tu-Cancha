import { useEffect, useRef } from 'react'

// Fondo del hero: las líneas de una cancha vista desde arriba (quietas y
// tenues) y manchas de color que flotan despacio. Con el mouse, las
// manchas se inclinan un poco hacia el cursor. El movimiento de las
// manchas es CSS (ver estilos.css); aquí solo se dibuja la cancha una vez
// y se pasa la posición del mouse.

const LINEA = { oscuro: 'rgba(255,255,255,.07)', claro: 'rgba(255,255,255,.5)' }

// Dibuja las líneas de la cancha en un canvas del tamaño del hero.
function pintarCancha(ctx, ancho, alto, linea) {
  ctx.clearRect(0, 0, ancho, alto)
  // En pantallas verticales (celular) la cancha se gira para que los
  // arcos queden arriba y abajo.
  ctx.save()
  if (alto > ancho) {
    ctx.translate(ancho, 0)
    ctx.rotate(Math.PI / 2)
    ;[ancho, alto] = [alto, ancho]
  }

  const m = Math.max(24, Math.min(ancho, alto) * 0.07)
  const x0 = m, y0 = m, x1 = ancho - m, y1 = alto - m
  const cx = ancho / 2, cy = alto / 2
  const h = y1 - y0
  const areaAlto = h * 0.6, areaAncho = Math.min(h * 0.32, (x1 - x0) * 0.16)
  const chicaAlto = h * 0.3, chicaAncho = areaAncho * 0.4
  const radioCentro = Math.min(h * 0.17, (x1 - x0) * 0.1)

  ctx.strokeStyle = linea
  ctx.fillStyle = linea
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.rect(x0, y0, x1 - x0, h)
  ctx.moveTo(cx, y0); ctx.lineTo(cx, y1)
  ctx.moveTo(cx + radioCentro, cy); ctx.arc(cx, cy, radioCentro, 0, Math.PI * 2)
  // Áreas grandes y chicas de los dos lados
  ctx.rect(x0, cy - areaAlto / 2, areaAncho, areaAlto)
  ctx.rect(x1 - areaAncho, cy - areaAlto / 2, areaAncho, areaAlto)
  ctx.rect(x0, cy - chicaAlto / 2, chicaAncho, chicaAlto)
  ctx.rect(x1 - chicaAncho, cy - chicaAlto / 2, chicaAncho, chicaAlto)
  // Medialunas del área
  const r = radioCentro * 0.8
  ctx.moveTo(x0 + areaAncho, cy - r * 0.6); ctx.arc(x0 + areaAncho * 0.7, cy, r, -0.9, 0.9)
  ctx.moveTo(x1 - areaAncho, cy + r * 0.6); ctx.arc(x1 - areaAncho * 0.7, cy, r, Math.PI - 0.9, Math.PI + 0.9)
  // Arcos de esquina
  const re = 14
  ctx.moveTo(x0 + re, y0); ctx.arc(x0, y0, re, 0, Math.PI / 2)
  ctx.moveTo(x1, y0 + re); ctx.arc(x1, y0, re, Math.PI / 2, Math.PI)
  ctx.moveTo(x0, y1 - re); ctx.arc(x0, y1, re, -Math.PI / 2, 0)
  ctx.moveTo(x1 - re, y1); ctx.arc(x1, y1, re, Math.PI, Math.PI * 1.5)
  ctx.stroke()
  // Punto central y puntos penales
  for (const px of [cx, x0 + areaAncho * 0.7, x1 - areaAncho * 0.7]) {
    ctx.beginPath(); ctx.arc(px, cy, 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

export default function FondoHero() {
  const fondoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(function () {
    const fondo = fondoRef.current
    const canvas = canvasRef.current
    const seccion = fondo.closest('section')
    if (!seccion) return
    const ctx = canvas.getContext('2d')

    function dibujar() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const ancho = seccion.clientWidth
      const alto = seccion.clientHeight
      canvas.width = ancho * dpr
      canvas.height = alto * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const tema = document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'
      pintarCancha(ctx, ancho, alto, LINEA[tema])
    }
    dibujar()

    // Se redibuja si cambia el ancho (no el alto: en el celular la barra
    // del navegador lo cambia al hacer scroll) o si cambia el tema.
    let ultimoAncho = seccion.clientWidth
    function alRedimensionar() {
      if (seccion.clientWidth !== ultimoAncho) {
        ultimoAncho = seccion.clientWidth
        dibujar()
      }
    }
    addEventListener('resize', alRedimensionar)
    const vigilaTema = new MutationObserver(dibujar)
    vigilaTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })

    // Mouse: -1..1 en cada eje; el CSS mueve las manchas con eso.
    function alMover(e) {
      const r = seccion.getBoundingClientRect()
      fondo.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3))
      fondo.style.setProperty('--my', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3))
    }
    function alSalir() {
      fondo.style.setProperty('--mx', 0)
      fondo.style.setProperty('--my', 0)
    }
    const conMouse = matchMedia('(pointer: fine)').matches
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (conMouse && !quieto) {
      seccion.addEventListener('pointermove', alMover)
      seccion.addEventListener('pointerleave', alSalir)
    }

    return function () {
      removeEventListener('resize', alRedimensionar)
      vigilaTema.disconnect()
      seccion.removeEventListener('pointermove', alMover)
      seccion.removeEventListener('pointerleave', alSalir)
    }
  }, [])

  return (
    <div ref={fondoRef} className="hero-fondo" aria-hidden="true">
      <span className="hero-mancha hero-mancha-1" />
      <span className="hero-mancha hero-mancha-2" />
      <span className="hero-mancha hero-mancha-3" />
      <canvas ref={canvasRef} className="hero-fondo-cancha" />
    </div>
  )
}
