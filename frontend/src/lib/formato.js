// Formatos y colores compartidos por las gráficas del panel.

// Paleta categórica validada (orden fijo, nunca rotar): azul, naranja, aqua.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a']

const numero = new Intl.NumberFormat('es-CO')
export const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

export function formatoNumero(n) {
  return numero.format(n ?? 0)
}

export function formatoPesos(n, corto = false) {
  return '$' + (corto ? compacto.format(n ?? 0) : numero.format(n ?? 0))
}

// ---------------------------------------------------------------------
// Fechas locales
// ---------------------------------------------------------------------
// toISOString() devuelve UTC. En Colombia (UTC-5) eso significa que a
// partir de las 7 p. m. ya reporta el día siguiente. Esta función lee el
// día del reloj local. Vive aquí para que haya una sola versión: estaba
// duplicada en Partidos.jsx, Torneos.jsx y CanchaCard.jsx.
// ---------------------------------------------------------------------
export function fechaLocal(desplazamientoDias = 0) {
  const d = new Date()
  if (desplazamientoDias) d.setDate(d.getDate() + desplazamientoDias)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function hoyLocal() {
  return fechaLocal(0)
}
