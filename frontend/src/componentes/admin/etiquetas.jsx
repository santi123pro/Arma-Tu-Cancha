// Nombres visibles de los estados y catálogos que usan la analítica
// del panel y su exportación a CSV.

export const ESTADOS_PARTIDO = { abierto: 'Abierto', completo: 'Completo', jugado: 'Jugado', cancelado: 'Cancelado' }
export const ESTADOS_TORNEO = {
  inscripciones: 'Inscripciones abiertas', cerrado: 'Cupos completos', en_curso: 'En curso',
  finalizado: 'Finalizado', cancelado: 'Cancelado',
}
export const ESTADOS_RESERVA = {
  completada: 'Jugadas', confirmada: 'Confirmadas', pendiente: 'Pendientes de pago',
  cancelada: 'Canceladas', no_asistio: 'No asistieron',
}
export const METODOS_PAGO = {
  efectivo: 'Efectivo', nequi: 'Nequi', breb: 'Bre-B', daviplata: 'Daviplata',
  transferencia: 'Transferencia', sin_registrar: 'Sin registrar',
}
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const ROLES = {
  jugador: 'Jugadores',
  admin_sede: 'Administradores de sede',
  superadmin: 'Administradores generales',
}
