// ─────────────────────────────────────────────────────────────────────
// Simulación del pago con QR (Nequi / Bre-B), sin Supabase.
//
// Reemplaza a src/lib/datos.js solo en la página de demostración (ver
// vite.demo.config.js). Imita las reglas de la migración 0014 en memoria:
// la reserva nace pendiente, aparta el horario hasta que vence el plazo,
// el jugador envía el comprobante y la sede lo aprueba o lo rechaza.
// Nada de esto toca la base de datos real.
// ─────────────────────────────────────────────────────────────────────

import { ERROR_FRANJA_OCUPADA } from '../src/lib/supabase'

const YO = 'jugador-demo'
const espera = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const ok = (datos) => espera().then(() => ({ datos, error: null }))
const falla = (error) => espera().then(() => ({ datos: null, error }))

// Captura de comprobante de muestra para las solicitudes de ejemplo.
function comprobanteDeMuestra(medio, valor, ref) {
  const color = medio === 'nequi' ? '#da0081' : '#0b5cff'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260"><rect width="200" height="260" fill="#fff"/><rect width="200" height="56" fill="${color}"/><text x="100" y="35" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${medio === 'nequi' ? 'Nequi' : 'Bre-B'}</text><text x="100" y="100" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">Pago exitoso</text><text x="100" y="135" font-family="sans-serif" font-size="24" font-weight="700" fill="#0f172a" text-anchor="middle">$ ${valor.toLocaleString('es-CO')}</text><text x="100" y="180" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Referencia</text><text x="100" y="198" font-family="monospace" font-size="13" fill="#0f172a" text-anchor="middle">${ref}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function hoyMas(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SEDE_INICIAL = {
  id: 1,
  nombre: 'Wembley Norte',
  slug: 'wembley',
  color_hex: '#f97316',
  hora_apertura: '06:00:00',
  hora_cierre: '23:00:00',
  pago_instrucciones: 'Escribe el código de la reserva en la descripción del pago.',
  pago_minutos_limite: 10,
}

// Sin qr_url: la pasarela muestra el QR general (public/pagos/).
const METODOS_INICIALES = [
  { tipo: 'nequi', activo: true, qr_url: null, titular: 'Wembley Norte SAS', cuenta: '300 111 2233' },
  { tipo: 'breb', activo: true, qr_url: null, titular: 'Wembley Norte SAS', cuenta: '@wembleynorte' },
]

const CANCHAS = [
  { id: 1, nombre: 'Cancha 1', tipo: 'Fútbol 6', precio_hora: 120000 },
  { id: 2, nombre: 'Cancha 2', tipo: 'Fútbol 8', precio_hora: 150000 },
]

const CLIENTES = {
  [YO]: { nombre: 'Juan Pérez (tú)', telefono: '3001234567', correo: 'juan@ejemplo.com' },
  ana: { nombre: 'Ana Gómez', telefono: '3157654321', correo: 'ana@ejemplo.com' },
  luis: { nombre: 'Luis Martínez', telefono: '3209998877', correo: 'luis@ejemplo.com' },
}

let estado
let siguienteId
const archivos = new Map()
const oyentes = new Set()

function avisar() {
  oyentes.forEach((fn) => fn())
}

export function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

function nuevaReserva(datos) {
  const cancha = CANCHAS.find((c) => c.id === datos.cancha_id)
  const [h] = datos.hora_inicio.split(':').map(Number)
  return {
    id: siguienteId++,
    codigo: 'WEM-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    hora_fin: `${String(h + 1).padStart(2, '0')}:00:00`,
    precio_total: cancha.precio_hora,
    pago_medio: null,
    pago_referencia: null,
    comprobante_path: null,
    pago_reportado_at: null,
    pago_revisado_at: null,
    pago_motivo_rechazo: null,
    metodo_pago: null,
    creado_at: new Date().toISOString(),
    ...datos,
  }
}

export function reiniciar() {
  siguienteId = 100
  estado = { sede: { ...SEDE_INICIAL }, metodos: METODOS_INICIALES.map((m) => ({ ...m })), reservas: [] }
  archivos.set('demo/ana.svg', comprobanteDeMuestra('nequi', 150000, 'M8841207'))
  archivos.set('demo/ana-vieja.svg', comprobanteDeMuestra('breb', 120000, 'BB7712093'))
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
  estado.reservas.push(
    nuevaReserva({
      cancha_id: 2, usuario: 'ana', fecha: hoyMas(1), hora_inicio: '19:00:00',
      estado: 'pendiente', pago_estado: 'por_verificar', pago_vence_at: hace(-4),
      pago_medio: 'nequi', pago_referencia: 'M8841207', comprobante_path: 'demo/ana.svg',
      pago_reportado_at: hace(24),
    }),
    nuevaReserva({
      cancha_id: 1, usuario: 'luis', fecha: hoyMas(2), hora_inicio: '20:00:00',
      estado: 'pendiente', pago_estado: 'esperando_pago', pago_vence_at: hace(-7),
    }),
    nuevaReserva({
      cancha_id: 1, usuario: 'ana', fecha: hoyMas(-2), hora_inicio: '18:00:00',
      estado: 'confirmada', pago_estado: 'aprobado', pago_medio: 'breb', metodo_pago: 'breb',
      pago_referencia: 'BB7712093', comprobante_path: 'demo/ana-vieja.svg',
      pago_reportado_at: hace(3000), pago_revisado_at: hace(2990),
    }),
  )
  avisar()
}
reiniciar()

// Igual que liberar_reservas_vencidas(): sin comprobante a tiempo, se cancela.
function liberarVencidas() {
  const ahora = Date.now()
  for (const r of estado.reservas) {
    if (r.estado === 'pendiente' && r.pago_estado === 'esperando_pago' && new Date(r.pago_vence_at) < ahora) {
      r.estado = 'cancelada'
      r.pago_estado = 'vencido'
    }
  }
}

// Botón de la demo: adelanta el reloj de las solicitudes sin pagar.
export function forzarVencimiento() {
  for (const r of estado.reservas) {
    if (r.estado === 'pendiente' && r.pago_estado === 'esperando_pago') {
      r.pago_vence_at = new Date(Date.now() - 1000).toISOString()
    }
  }
  avisar()
}

function ocupa(r) {
  if (r.estado === 'confirmada') return true
  if (r.estado !== 'pendiente') return false
  return !(r.pago_estado === 'esperando_pago' && new Date(r.pago_vence_at) < Date.now())
}

function conRelaciones(r) {
  const cancha = CANCHAS.find((c) => c.id === r.cancha_id)
  return {
    ...r,
    canchas: { nombre: cancha.nombre, tipo: cancha.tipo, sede_id: estado.sede.id, sedes: { nombre: estado.sede.nombre } },
  }
}

// ── Lo que usan las pantallas (mismas firmas que src/lib/datos.js) ──

export function listarSedes() {
  return ok([{ ...estado.sede, canchas: CANCHAS }])
}

export function datosPagoSede() {
  return ok({
    metodos: estado.metodos.filter((m) => m.activo).map((m) => ({ ...m })),
    instrucciones: estado.sede.pago_instrucciones,
  })
}

export function disponibilidad(canchaId, fecha) {
  const ahora = new Date()
  const hoy = hoyMas(0)
  const franjas = []
  for (let h = 6; h < 23; h++) {
    const inicio = `${String(h).padStart(2, '0')}:00:00`
    const ocupada = estado.reservas.some((r) => r.cancha_id === canchaId && r.fecha === fecha && r.hora_inicio === inicio && ocupa(r))
    const pasada = fecha === hoy && h <= ahora.getHours()
    franjas.push({ hora_inicio: inicio, hora_fin: `${String(h + 1).padStart(2, '0')}:00:00`, disponible: !ocupada && !pasada })
  }
  return ok(franjas)
}

export function crearReserva({ canchaId, fecha, hora }) {
  const s = estado.sede
  if (!estado.metodos.some((m) => m.activo)) {
    return falla(`${s.nombre} todavía no ha configurado sus medios de pago. Comunícate con la sede para reservar.`)
  }
  const sinPagar = estado.reservas.filter((r) => r.usuario === YO && r.estado === 'pendiente' &&
    r.pago_estado === 'esperando_pago' && new Date(r.pago_vence_at) > Date.now())
  if (sinPagar.length >= 2) {
    return falla('Tienes dos reservas esperando pago. Págalas o cancélalas antes de solicitar otra.')
  }
  liberarVencidas()
  if (estado.reservas.some((r) => r.cancha_id === canchaId && r.fecha === fecha && r.hora_inicio === hora && ocupa(r))) {
    return falla(ERROR_FRANJA_OCUPADA)
  }
  const r = nuevaReserva({
    cancha_id: canchaId, usuario: YO, fecha, hora_inicio: hora,
    estado: 'pendiente', pago_estado: 'esperando_pago',
    pago_vence_at: new Date(Date.now() + s.pago_minutos_limite * 60000).toISOString(),
  })
  estado.reservas.push(r)
  avisar()
  return ok(conRelaciones(r))
}

export function estadoReserva(id) {
  const r = estado.reservas.find((x) => x.id === id)
  if (!r) return falla('Esa reserva no existe.')
  const { estado: e, pago_estado, pago_medio, pago_motivo_rechazo } = r
  return ok({ id, estado: e, pago_estado, pago_medio, pago_motivo_rechazo })
}

export async function subirComprobante(reservaId, archivo) {
  const ruta = `${reservaId}/${Date.now()}-${archivo.name}`
  archivos.set(ruta, URL.createObjectURL(archivo))
  return ok(ruta)
}

export function reportarPago(reservaId, { medio, comprobante, referencia = null }) {
  const r = estado.reservas.find((x) => x.id === reservaId)
  if (!r) return falla('Esa reserva no existe.')
  if (r.pago_estado === 'por_verificar') return falla('Ya enviaste este comprobante. La sede lo está verificando.')
  if (r.estado !== 'pendiente' || r.pago_estado !== 'esperando_pago') return falla('Esta reserva ya no admite pagos.')
  if (new Date(r.pago_vence_at) < Date.now()) {
    return falla('El tiempo para pagar venció y el horario se liberó. Solicita la reserva de nuevo.')
  }
  if (!estado.metodos.some((m) => m.tipo === medio && m.activo)) return falla('Elige un medio de pago que acepte la sede.')
  if (!comprobante) return falla('Adjunta el comprobante del pago.')
  Object.assign(r, {
    pago_estado: 'por_verificar',
    pago_medio: medio,
    pago_referencia: referencia || null,
    comprobante_path: comprobante,
    pago_reportado_at: new Date().toISOString(),
  })
  avisar()
  return ok(conRelaciones(r))
}

export function cancelarReserva(id) {
  const r = estado.reservas.find((x) => x.id === id)
  if (!r) return falla('Esa reserva no existe.')
  if (r.estado === 'cancelada') return falla('Esa reserva ya estaba cancelada.')
  const inicio = new Date(`${r.fecha}T${r.hora_inicio}`)
  if (r.pago_estado !== 'esperando_pago' && (inicio - Date.now()) / 3600000 < 24) {
    return falla('Faltan menos de 24 horas. Comunícate con la sede.')
  }
  r.estado = 'cancelada'
  if (r.pago_estado === 'esperando_pago') r.pago_estado = 'cancelado'
  avisar()
  return ok(r)
}

export function misReservasEnSede() {
  const mias = estado.reservas
    .filter((r) => r.usuario === YO)
    .map(conRelaciones)
    .sort((a, b) => (b.fecha + b.hora_inicio).localeCompare(a.fecha + a.hora_inicio))
  return ok(mias)
}

export async function urlComprobante(ruta) {
  const url = archivos.get(ruta)
  return url ? ok(url) : falla('Este es un dato de ejemplo: no tiene un archivo real adjunto.')
}

export function pagosSede() {
  liberarVencidas()
  const fila = (r) => {
    const c = CLIENTES[r.usuario]
    const cancha = CANCHAS.find((x) => x.id === r.cancha_id)
    return {
      ...r,
      cancha: cancha.nombre,
      cancha_tipo: cancha.tipo,
      cliente: c.nombre,
      telefono: c.telefono,
      correo: c.correo,
    }
  }
  const lista = estado.reservas.map(fila)
  return ok({
    sede: { ...estado.sede },
    metodos: estado.metodos.map((m) => ({ ...m })),
    por_verificar: lista.filter((r) => r.estado === 'pendiente' && r.pago_estado === 'por_verificar'),
    esperando_pago: lista.filter((r) => r.estado === 'pendiente' && r.pago_estado === 'esperando_pago'),
    revisados: lista
      .filter((r) => ['aprobado', 'rechazado'].includes(r.pago_estado))
      .sort((a, b) => (b.pago_revisado_at ?? '').localeCompare(a.pago_revisado_at ?? '')),
  })
}

export function revisarPago(id, aprobar, { metodo = null, motivo = null } = {}) {
  const r = estado.reservas.find((x) => x.id === id)
  if (!r || r.estado !== 'pendiente' || !['esperando_pago', 'por_verificar'].includes(r.pago_estado)) {
    return falla('Este pago ya fue revisado o la reserva se canceló.')
  }
  if (aprobar) {
    Object.assign(r, { estado: 'confirmada', pago_estado: 'aprobado', metodo_pago: metodo ?? r.pago_medio ?? 'transferencia' })
  } else {
    if (!motivo) return falla('Escribe el motivo del rechazo para que el jugador sepa qué pasó.')
    Object.assign(r, { estado: 'cancelada', pago_estado: 'rechazado', pago_motivo_rechazo: motivo })
  }
  r.pago_revisado_at = new Date().toISOString()
  avisar()
  return ok(r)
}

export function configurarPagoSede(_sedeId, { metodos, instrucciones, minutos }) {
  if (!metodos.some((m) => m.activo)) {
    return falla('Deja activo al menos un medio de pago: sin él los jugadores no pueden reservar.')
  }
  estado.metodos = metodos.map((m) => ({ ...m, qr_url: m.qr_url || null }))
  Object.assign(estado.sede, {
    pago_instrucciones: instrucciones || null,
    pago_minutos_limite: Number(minutos),
  })
  avisar()
  return ok(estado.metodos)
}

export async function subirQrSede(_sedeId, archivo) {
  return ok(URL.createObjectURL(archivo))
}
