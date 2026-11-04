// Tipos de cancha de una sede, sin repetir.
export function tiposDe(sede) {
  const canchas = sede.canchas ?? []
  return [...new Set(canchas.map((c) => c.tipo).filter(Boolean))]
}
