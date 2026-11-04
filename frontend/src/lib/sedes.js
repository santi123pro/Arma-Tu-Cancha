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
