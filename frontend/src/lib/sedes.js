// Tipos de cancha de una sede, sin repetir. Unifica la escritura para que
// "Futbol 6" y "Fútbol 6" cuenten como un solo tipo.
export function tiposDe(sede) {
  const canchas = sede.canchas ?? []
  const tipos = canchas
    .filter((c) => c.tipo)
    .map((c) => c.tipo.trim().replace(/^f[uú]tbol/i, 'Fútbol'))
  return [...new Set(tipos)]
}

// crear_reserva acepta fechas entre hoy y hoy + 15 días. El selector de día
// usa el mismo rango para no ofrecer días que el backend va a rechazar.
export const DIAS_ANTICIPACION = 15

// '15:30:00' → minutos desde la medianoche
function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Igual que disponibilidad_cancha: una franja solo está libre si empieza
// después de la hora actual.
export function franjaYaPaso(horaInicio, ahora = new Date()) {
  return aMinutos(horaInicio) <= ahora.getHours() * 60 + ahora.getMinutes()
}

// ¿Ya pasó la última franja de hoy? Las franjas van de hora en hora desde la
// apertura y deben terminar antes del cierre: con cierre 23:59 y apertura
// 08:00, la última empieza a las 22:00, no a las 22:59.
export function hoyTermino(sede, ahora = new Date()) {
  if (!sede.hora_apertura || !sede.hora_cierre) return false
  const apertura = aMinutos(sede.hora_apertura)
  const franjas = Math.floor((aMinutos(sede.hora_cierre) - apertura) / 60)
  if (franjas < 1) return false
  const ultima = apertura + (franjas - 1) * 60
  return ultima <= ahora.getHours() * 60 + ahora.getMinutes()
}

// '2026-11-30' → '2026-12-01'
export function diaSiguiente(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  const siguiente = new Date(a, m - 1, d + 1)
  const mm = String(siguiente.getMonth() + 1).padStart(2, '0')
  const dd = String(siguiente.getDate()).padStart(2, '0')
  return `${siguiente.getFullYear()}-${mm}-${dd}`
}
