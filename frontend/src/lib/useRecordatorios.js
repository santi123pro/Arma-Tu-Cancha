import { useCallback, useEffect, useMemo, useState } from 'react'
import { misReservasEnSede } from './datos'

// Un partido entra al recordatorio cuando faltan 48 horas o menos: así
// "mañana" siempre aparece sin importar la hora del día, y también avisa
// "unas horas antes".
const VENTANA_HORAS = 48
const CLAVE_VISTOS = 'atc-recordatorios-vistos'

// Fecha y hora de la reserva en hora local del navegador.
function inicioReserva(r) {
  const [a, m, d] = r.fecha.split('-').map(Number)
  const [h, min] = r.hora_inicio.split(':').map(Number)
  return new Date(a, m - 1, d, h, min)
}

// ¿La reserva cae el mismo día del calendario que `ref`?
function mismoDia(fecha, ref) {
  return fecha.getFullYear() === ref.getFullYear() &&
    fecha.getMonth() === ref.getMonth() &&
    fecha.getDate() === ref.getDate()
}

// 'hoy' | 'manana' | 'pronto' según el día del partido.
function cuandoEs(inicio, ahora) {
  if (mismoDia(inicio, ahora)) return 'hoy'
  const manana = new Date(ahora)
  manana.setDate(manana.getDate() + 1)
  if (mismoDia(inicio, manana)) return 'manana'
  return 'pronto'
}

function leerVistos() {
  try {
    const crudo = localStorage.getItem(CLAVE_VISTOS)
    return new Set(crudo ? JSON.parse(crudo) : [])
  } catch {
    return new Set()
  }
}

function guardarVistos(ids) {
  try {
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...ids]))
  } catch {
    /* Navegador sin almacenamiento (ventana privada): el puntico rojo
       simplemente volverá a aparecer. No es grave. */
  }
}

// Recordatorios de las canchas que el jugador tiene reservadas en las
// próximas 48 horas. No necesita backend: se calcula desde sus reservas.
export function useRecordatorios(autenticado) {
  const [reservas, setReservas] = useState([])
  const [vistos, setVistos] = useState(() => leerVistos())

  const recargar = useCallback(() => {
    if (!autenticado) return
    misReservasEnSede(null).then(({ datos, error }) => {
      if (!error) setReservas(datos ?? [])
    })
  }, [autenticado])

  // Al entrar, y cada vez que la pestaña vuelve a primer plano (el usuario
  // deja la app abierta y regresa horas después).
  useEffect(() => {
    recargar()
    const alEnfocar = () => { if (document.visibilityState === 'visible') recargar() }
    document.addEventListener('visibilitychange', alEnfocar)
    window.addEventListener('focus', alEnfocar)
    return () => {
      document.removeEventListener('visibilitychange', alEnfocar)
      window.removeEventListener('focus', alEnfocar)
    }
  }, [recargar])

  const recordatorios = useMemo(() => {
    const ahora = new Date()
    const limite = new Date(ahora.getTime() + VENTANA_HORAS * 3600000)
    return reservas
      .filter((r) => r.estado === 'confirmada')
      .map((r) => ({ reserva: r, inicio: inicioReserva(r) }))
      .filter(({ inicio }) => inicio > ahora && inicio <= limite)
      .sort((a, b) => a.inicio - b.inicio)
      .map(({ reserva, inicio }) => ({
        id: reserva.id,
        sede: reserva.canchas?.sedes?.nombre ?? 'la sede',
        cancha: reserva.canchas?.nombre ?? 'Cancha',
        inicio,
        horaInicio: reserva.hora_inicio,
        horaFin: reserva.hora_fin,
        horasFaltan: (inicio - ahora) / 3600000,
        cuando: cuandoEs(inicio, ahora),
      }))
  }, [reservas])

  const sinVer = recordatorios.filter((r) => !vistos.has(r.id)).length

  // Al abrir el panel, los recordatorios actuales quedan "vistos" y el
  // puntico rojo desaparece.
  const marcarVistos = useCallback(() => {
    setVistos((previos) => {
      const siguiente = new Set(previos)
      recordatorios.forEach((r) => siguiente.add(r.id))
      guardarVistos(siguiente)
      return siguiente
    })
  }, [recordatorios])

  return { recordatorios, sinVer, marcarVistos, recargar }
}
