// QR de ejemplo (no lleva a ningún pago real). Se muestra mientras la
// sede no haya subido el QR de ese medio de pago. Cada `semilla` da un
// dibujo distinto, así Nequi y Bre-B no se ven iguales.
export function qrGenerico(semilla = 7) {
  const n = 25
  let s = semilla
  const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const enEsquina = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)
  let celdas = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!enEsquina(x, y) && azar() > 0.52) celdas += `<rect x="${x}" y="${y}" width="1" height="1"/>`
    }
  }
  const ojo = (x, y) =>
    `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><g fill="#0f172a">${celdas}${ojo(0, 0)}${ojo(n - 7, 0)}${ojo(0, n - 7)}</g></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// Tiempos del pago (migración 0015): el jugador paga y envía el
// comprobante en 10 minutos; la sede lo confirma en 30.
export const MINUTOS_PARA_PAGAR = 10
export const MINUTOS_PARA_CONFIRMAR = 30

// Medios de pago que puede configurar una sede (tabla sede_metodos_pago).
export const MEDIOS_PAGO = {
  nequi: {
    nombre: 'Nequi',
    cuenta: 'Celular Nequi',
    ayudaCuenta: 'El número al que te transfieren desde Nequi.',
    placeholder: '300 000 0000',
    app: 'Abre Nequi, toca «Pagar con QR» y escanea el código.',
    semilla: 7,
  },
  breb: {
    nombre: 'Bre-B',
    cuenta: 'Llave Bre-B',
    ayudaCuenta: 'Celular, cédula, correo o llave alfanumérica (@tusede).',
    placeholder: '@tusede o 300 000 0000',
    app: 'Desde la app de cualquier banco, elige Bre-B, escanea el QR o usa la llave.',
    semilla: 31,
  },
}
