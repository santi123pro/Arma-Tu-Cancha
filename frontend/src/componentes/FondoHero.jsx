import { useEffect, useRef } from 'react'

// Fondo del hero: una cancha vista desde arriba, casi a oscuras, y un
// reflector de estadio que sigue el mouse y la ilumina. Un balón rueda
// hacia el cursor (con clic se patea). Sin mouse (celular), el balón
// rueda solo y el reflector lo sigue. Con "reducir movimiento" la cancha
// queda quieta, sin balón.

const COLORES = {
  oscuro: {
    franja: 'rgba(34,197,94,.05)', linea: 'rgba(255,255,255,.07)',
    franjaLuz: 'rgba(34,197,94,.30)', lineaLuz: 'rgba(255,255,255,.7)', baseLuz: 'rgba(22,101,52,.35)',
    brillo: '255,250,225', brilloAlfa: 0.12,
  },
  claro: {
    franja: 'rgba(22,163,74,.06)', linea: 'rgba(255,255,255,.45)',
    franjaLuz: 'rgba(22,163,74,.22)', lineaLuz: 'rgba(255,255,255,.95)', baseLuz: 'rgba(74,222,128,.25)',
    brillo: '255,255,255', brilloAlfa: 0.35,
  },
}

// Dibuja la cancha completa (franjas + líneas) en un canvas del tamaño del hero.
function pintarCancha(ctx, ancho, alto, { franja, linea, base }) {
  ctx.clearRect(0, 0, ancho, alto)
  if (base) {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, ancho, alto)
  }

  // En pantallas verticales (celular) la cancha se gira para que los
  // arcos queden arriba y abajo.
  ctx.save()
  if (alto > ancho) {
    ctx.translate(ancho, 0)
    ctx.rotate(Math.PI / 2)
    ;[ancho, alto] = [alto, ancho]
  }

  const numFranjas = ancho < 700 ? 8 : 14
  const anchoFranja = ancho / numFranjas
  ctx.fillStyle = franja
  for (let i = 0; i < numFranjas; i += 2) ctx.fillRect(i * anchoFranja, 0, anchoFranja, alto)

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

function pentagono(ctx, x, y, radio, giro) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = giro + (i * Math.PI * 2) / 5 - Math.PI / 2
    ctx.lineTo(x + Math.cos(a) * radio, y + Math.sin(a) * radio)
  }
  ctx.closePath()
  ctx.fill()
}

function pintarBalon(ctx, b) {
  const { x, y, r, giro } = b
  // Sombra
  const sombra = ctx.createRadialGradient(x + 4, y + 7, 0, x + 4, y + 7, r * 1.3)
  sombra.addColorStop(0, 'rgba(0,0,0,.35)')
  sombra.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = sombra
  ctx.beginPath(); ctx.arc(x + 4, y + 7, r * 1.3, 0, Math.PI * 2); ctx.fill()

  ctx.save()
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  const cuero = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  cuero.addColorStop(0, '#ffffff')
  cuero.addColorStop(1, '#cfd5dd')
  ctx.fillStyle = cuero
  ctx.fill()
  ctx.clip()
  ctx.fillStyle = '#1f2937'
  pentagono(ctx, x, y, r * 0.36, giro)
  for (let k = 0; k < 5; k++) {
    const a = giro + (k * Math.PI * 2) / 5 - Math.PI / 2
    pentagono(ctx, x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, r * 0.34, giro + Math.PI / 5)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,.25)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}

export default function FondoHero() {
  const canvasRef = useRef(null)

  useEffect(function () {
    const canvas = canvasRef.current
    const seccion = canvas.closest('section')
    if (!seccion) return

    const ctx = canvas.getContext('2d')
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
    const conMouse = matchMedia('(pointer: fine)').matches
    const tenue = document.createElement('canvas')
    const iluminada = document.createElement('canvas')
    const foco = document.createElement('canvas')
    const mouse = { x: 0, y: 0, activo: false }
    const balon = { x: 0, y: 0, vx: 0, vy: 0, r: 15, giro: 0 }
    const luz = { x: 0, y: 0 }
    let paseo = { x: 0, y: 0, hasta: 0 }
    let ancho = 0, alto = 0, dpr = 1, radioLuz = 220
    let temaActual = ''
    let visible = true, frame = 0

    function tema() {
      return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'
    }

    function prepararCanchas() {
      temaActual = tema()
      const c = COLORES[temaActual]
      for (const lienzo of [tenue, iluminada]) {
        lienzo.width = ancho * dpr
        lienzo.height = alto * dpr
      }
      const t = tenue.getContext('2d')
      t.setTransform(dpr, 0, 0, dpr, 0, 0)
      pintarCancha(t, ancho, alto, { franja: c.franja, linea: c.linea })
      const i = iluminada.getContext('2d')
      i.setTransform(dpr, 0, 0, dpr, 0, 0)
      pintarCancha(i, ancho, alto, { franja: c.franjaLuz, linea: c.lineaLuz, base: c.baseLuz })
    }

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2)
      ancho = seccion.clientWidth
      alto = seccion.clientHeight
      canvas.width = ancho * dpr
      canvas.height = alto * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      radioLuz = Math.max(140, Math.min(260, ancho * 0.22))
      foco.width = foco.height = Math.ceil(radioLuz * 2 * dpr)
      balon.r = ancho < 700 ? 12 : 15
      prepararCanchas()
    }

    function iniciarBalon() {
      balon.x = ancho * 0.62
      balon.y = alto * 0.7
      luz.x = balon.x
      luz.y = balon.y
    }

    // Recorta un círculo de la cancha iluminada con borde suave y lo pone encima.
    function pintarLuz() {
      const c = COLORES[temaActual]
      const R = radioLuz
      const f = foco.getContext('2d')
      f.setTransform(dpr, 0, 0, dpr, 0, 0)
      f.globalCompositeOperation = 'source-over'
      f.clearRect(0, 0, R * 2, R * 2)
      f.drawImage(iluminada, (luz.x - R) * dpr, (luz.y - R) * dpr, R * 2 * dpr, R * 2 * dpr, 0, 0, R * 2, R * 2)
      const brillo = f.createRadialGradient(R, R, 0, R, R, R)
      brillo.addColorStop(0, `rgba(${c.brillo},${c.brilloAlfa})`)
      brillo.addColorStop(1, `rgba(${c.brillo},0)`)
      f.fillStyle = brillo
      f.fillRect(0, 0, R * 2, R * 2)
      f.globalCompositeOperation = 'destination-in'
      const borde = f.createRadialGradient(R, R, R * 0.15, R, R, R)
      borde.addColorStop(0, 'rgba(0,0,0,1)')
      borde.addColorStop(0.55, 'rgba(0,0,0,.6)')
      borde.addColorStop(1, 'rgba(0,0,0,0)')
      f.fillStyle = borde
      f.fillRect(0, 0, R * 2, R * 2)
      ctx.drawImage(foco, luz.x - R, luz.y - R, R * 2, R * 2)
    }

    function mover(ahora) {
      // A dónde va el balón: al mouse, o a un punto al azar si no hay mouse.
      let destino = mouse
      if (!mouse.activo) {
        if (ahora > paseo.hasta) {
          paseo = {
            x: ancho * (0.15 + Math.random() * 0.7),
            y: alto * (0.2 + Math.random() * 0.65),
            hasta: ahora + 2500 + Math.random() * 2500,
          }
        }
        destino = paseo
      }
      const fuerza = mouse.activo ? 0.012 : 0.004
      balon.vx += (destino.x - balon.x) * fuerza
      balon.vy += (destino.y - balon.y) * fuerza
      balon.vx *= 0.91
      balon.vy *= 0.91
      const v = Math.hypot(balon.vx, balon.vy)
      if (v > 30) { balon.vx *= 30 / v; balon.vy *= 30 / v }
      balon.x += balon.vx
      balon.y += balon.vy
      const { r } = balon
      if (balon.x < r) { balon.x = r; balon.vx = Math.abs(balon.vx) * 0.7 }
      if (balon.x > ancho - r) { balon.x = ancho - r; balon.vx = -Math.abs(balon.vx) * 0.7 }
      if (balon.y < r) { balon.y = r; balon.vy = Math.abs(balon.vy) * 0.7 }
      if (balon.y > alto - r) { balon.y = alto - r; balon.vy = -Math.abs(balon.vy) * 0.7 }
      balon.giro += (Math.hypot(balon.vx, balon.vy) / r) * Math.sign(balon.vx || 1)

      // El reflector apunta al mouse; sin mouse, sigue al balón.
      const objetivo = mouse.activo ? mouse : balon
      luz.x += (objetivo.x - luz.x) * 0.12
      luz.y += (objetivo.y - luz.y) * 0.12
    }

    function dibujar(ahora) {
      if (tema() !== temaActual) prepararCanchas()
      mover(ahora)
      ctx.clearRect(0, 0, ancho, alto)
      ctx.drawImage(tenue, 0, 0, ancho, alto)
      pintarLuz()
      pintarBalon(ctx, balon)
    }

    function ciclo(ahora) {
      dibujar(ahora)
      frame = visible ? requestAnimationFrame(ciclo) : 0
    }

    medir()
    iniciarBalon()

    if (quieto) {
      // Solo la cancha, sin animación.
      ctx.drawImage(tenue, 0, 0, ancho, alto)
      return
    }

    frame = requestAnimationFrame(ciclo)

    // Solo se recalcula si cambia el ancho: en el celular la barra del
    // navegador cambia el alto al hacer scroll y no queremos reiniciar.
    let ultimoAncho = ancho
    function alRedimensionar() {
      if (seccion.clientWidth !== ultimoAncho) {
        ultimoAncho = seccion.clientWidth
        medir()
        iniciarBalon()
      }
    }
    addEventListener('resize', alRedimensionar)

    // Se pausa cuando el hero no está en pantalla, para no gastar batería.
    const observador = new IntersectionObserver(function ([entrada]) {
      visible = entrada.isIntersecting
      if (visible && !frame) frame = requestAnimationFrame(ciclo)
    })
    observador.observe(seccion)

    function posicion(e) {
      const r = seccion.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    function alMover(e) {
      Object.assign(mouse, posicion(e), { activo: true })
    }
    function alSalir() {
      mouse.activo = false
    }
    // Clic cerca del balón: patada en la dirección contraria al clic.
    function alPatear(e) {
      if (e.target.closest('a, button, input, select, textarea, label')) return
      const p = posicion(e)
      const dx = balon.x - p.x, dy = balon.y - p.y
      const d = Math.hypot(dx, dy)
      if (d > 140) return
      const golpe = 26 * (1 - d / 180)
      // Si el clic cae justo encima, sale en una dirección al azar.
      const angulo = d > 4 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2
      balon.vx += Math.cos(angulo) * golpe
      balon.vy += Math.sin(angulo) * golpe
    }
    if (conMouse) {
      seccion.addEventListener('pointermove', alMover)
      seccion.addEventListener('pointerleave', alSalir)
      seccion.addEventListener('pointerdown', alPatear)
    }

    return function () {
      cancelAnimationFrame(frame)
      observador.disconnect()
      removeEventListener('resize', alRedimensionar)
      seccion.removeEventListener('pointermove', alMover)
      seccion.removeEventListener('pointerleave', alSalir)
      seccion.removeEventListener('pointerdown', alPatear)
    }
  }, [])

  return (
    <div className="hero-fondo" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-fondo-cancha" />
    </div>
  )
}
