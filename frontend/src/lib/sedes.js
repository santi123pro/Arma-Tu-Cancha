// Tipos de cancha de una sede, sin repetir. Unifica la escritura para que
// "Futbol 6" y "Fútbol 6" cuenten como un solo tipo.
export function tiposDe(sede) {
  const canchas = sede.canchas ?? []
  const tipos = canchas
    .filter((c) => c.tipo)
    .map((c) => c.tipo.trim().replace(/^f[uú]tbol/i, 'Fútbol'))
  return [...new Set(tipos)]
}
