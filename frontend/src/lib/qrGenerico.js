// QR general de Arma Tu Cancha para cada medio de pago. Se muestra
// mientras la sede no haya subido el suyo. Las imágenes van en
// frontend/public/pagos/ con estos nombres:
//   qr-nequi.png   QR de cobro descargado desde la app de Nequi
//   qr-breb.png    QR de cobro Bre-B descargado desde la app del banco
// Si el archivo no está, la pasarela no muestra QR (solo el número).
export function qrPorDefecto(tipo) {
  return `${import.meta.env.BASE_URL}pagos/qr-${tipo}.png`
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
  },
  breb: {
    nombre: 'Bre-B',
    cuenta: 'Llave Bre-B',
    ayudaCuenta: 'Celular, cédula, correo o llave alfanumérica (@tusede).',
    placeholder: '@tusede o 300 000 0000',
    app: 'Desde la app de cualquier banco, elige Bre-B, escanea el QR o usa la llave.',
  },
}
