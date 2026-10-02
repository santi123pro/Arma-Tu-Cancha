import { GOATCOUNTER_CODIGO } from './sitio'

// Analíticas sin cookies (GoatCounter). Solo cuenta qué pantalla se vio:
// no guarda nada en el navegador ni envía datos de la cuenta.
//
// La app no cambia de URL al navegar, así que cada pantalla se registra
// a mano con una ruta "virtual" ('/sede/wembley', '/mis-reservas'…).

let cargado = false

function cargar() {
  if (cargado || !GOATCOUNTER_CODIGO) return
  cargado = true
  window.goatcounter = { no_onload: true }
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODIGO}.goatcounter.com/count`
  document.head.appendChild(s)
}

export function registrarVisita(ruta, titulo) {
  if (!GOATCOUNTER_CODIGO) return
  cargar()
  // El script puede no haber llegado todavía: se reintenta un momento.
  let intentos = 0
  const enviar = () => {
    if (window.goatcounter?.count) window.goatcounter.count({ path: ruta, title: titulo })
    else if (intentos++ < 20) setTimeout(enviar, 250)
  }
  enviar()
}
