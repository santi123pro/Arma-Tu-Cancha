import { useEffect, useRef } from 'react'
import { estadoReserva } from './datos'

const CADA_MS = 15000

// Mientras la reserva espera que la sede confirme el pago, pregunta su
// estado cada 15 segundos y avisa con onCambio(reservaActualizada) cuando
// la sede la confirma o la rechaza.
export function useSeguimientoReserva(reserva, onCambio) {
  const avisar = useRef(onCambio)
  useEffect(() => { avisar.current = onCambio })

  const id = reserva?.id
  const esperando = reserva?.estado === 'pendiente' && reserva?.pago_estado === 'por_verificar'

  useEffect(() => {
    if (!id || !esperando) return
    let vigente = true
    const revisar = async () => {
      const { datos } = await estadoReserva(id)
      if (vigente && datos && datos.pago_estado !== 'por_verificar') avisar.current(datos)
    }
    const reloj = setInterval(revisar, CADA_MS)
    return () => { vigente = false; clearInterval(reloj) }
  }, [id, esperando])
}
