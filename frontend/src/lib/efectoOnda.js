// Efecto de onda al hacer clic en cualquier botón del proyecto.
//
// Un solo listener en el documento sirve para todos los botones, incluso
// los que React pinte después. La onda va dentro de un contenedor propio
// con overflow hidden, así no hay que tocar el overflow del botón.

const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)')

export function activarEfectoOnda() {
  document.addEventListener('pointerdown', (e) => {
    if (sinMovimiento.matches) return

    const boton = e.target.closest('button')
    if (!boton || boton.disabled) return

    // El contenedor se posiciona contra el botón. Si el botón ya tiene
    // position (absolute, relative...) se respeta para no moverlo.
    if (getComputedStyle(boton).position === 'static') boton.style.position = 'relative'

    const rect = boton.getBoundingClientRect()
    const tamano = Math.max(rect.width, rect.height) * 2

    const contenedor = document.createElement('span')
    contenedor.className = 'onda-contenedor'
    const onda = document.createElement('span')
    onda.className = 'onda'
    onda.style.width = onda.style.height = `${tamano}px`
    onda.style.left = `${e.clientX - rect.left - tamano / 2}px`
    onda.style.top = `${e.clientY - rect.top - tamano / 2}px`

    contenedor.appendChild(onda)
    boton.appendChild(contenedor)
    onda.addEventListener('animationend', () => contenedor.remove(), { once: true })
  })
}
