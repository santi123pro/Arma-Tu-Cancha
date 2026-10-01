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
