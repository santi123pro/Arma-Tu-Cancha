import { analiticaSede, contenidoAdmin, metricasGlobales, reservasParaExportar } from '../../lib/datos'
import { DIAS_SEMANA, ESTADOS_PARTIDO, ESTADOS_RESERVA, ESTADOS_TORNEO, METODOS_PAGO, ROLES } from './etiquetas'

// ═══════════════════════════════════════════════════════════════════
// Exportación de la analítica a CSV.
//
// Un solo archivo con los mismos reportes del panel, una sección debajo
// de la otra, y al final el detalle de cada reserva del periodo.
// Está pensado para abrirse en Excel en español (Colombia): columnas
// separadas con ';', decimales con ',' y UTF-8 con BOM para las tildes.
// ═══════════════════════════════════════════════════════════════════

const SEP = ';'

const ESTADO_RESERVA = {
  completada: 'Jugada', confirmada: 'Confirmada', pendiente: 'Pendiente de pago',
  cancelada: 'Cancelada', no_asistio: 'No asistió',
}

function celda(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(v).replace('.', ',')
  let t = String(v)
  // Un texto que empieza por '=', '@', '+' o '-' Excel lo toma como fórmula.
  // A los teléfonos ('+57 300…') basta con anteponerles un espacio.
  if (/^[+-][\d\s()-]*$/.test(t)) t = ' ' + t
  else if (/^[=@+\-\t\r]/.test(t)) t = "'" + t
  if (/[";\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"'
  return t
}

function seccion(titulo, encabezados, filas) {
  return [[titulo], encabezados, ...(filas.length ? filas : [['Sin datos en este periodo']]), []]
}

function num(n) {
  return Number(n ?? 0)
}

// '19:00:00' → '19:00'
function hora(h) {
  return h ? h.slice(0, 5) : ''
}

// '19:00:00' → '19:00 – 20:00'
function franja(h) {
  const n = Number(h.slice(0, 2))
  return `${hora(h)} – ${String((n + 1) % 24).padStart(2, '0')}:00`
}

// Fecha y hora de Colombia en formato ordenable: '2026-10-08 14:03'
function fechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16)
}

function contarPor(lista, clave, etiquetas) {
  const cuenta = {}
  for (const x of lista) cuenta[x[clave]] = (cuenta[x[clave]] ?? 0) + 1
  return Object.keys(etiquetas)
    .filter((k) => cuenta[k])
    .map((k) => [etiquetas[k], cuenta[k]])
}

function slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function detalleReservas(reservas) {
  return seccion(
    'Detalle de reservas',
    ['Código', 'Fecha', 'Hora inicio', 'Hora fin', 'Sede', 'Cancha', 'Cliente', 'Teléfono', 'Correo',
      'Estado', 'Método de pago', 'Valor (COP)', 'Creada el'],
    reservas.map((r) => [
      r.codigo, r.fecha, hora(r.hora_inicio), hora(r.hora_fin),
      r.canchas?.sedes?.nombre, r.canchas?.nombre,
      r.cliente_nombre, r.cliente_tel, r.cliente_correo,
      ESTADO_RESERVA[r.estado] ?? r.estado,
      r.metodo_pago ? METODOS_PAGO[r.metodo_pago] ?? r.metodo_pago : '',
      num(r.precio_total), fechaHora(r.creado_at),
    ]),
  )
}

function reportesSede(m, contenido, sedeId) {
  const { resumen: r, anterior: a } = m
  const partidos = contenido.partidos.filter((p) => p.canchas?.sede_id === sedeId)
  const torneos = contenido.torneos.filter((t) => t.sede_id === sedeId)

  return [
    ...seccion('Resumen', ['Indicador', 'Periodo', 'Periodo anterior'], [
      ['Ingresos (COP)', num(r.ingresos), num(a?.ingresos)],
      ['Reservas jugadas y confirmadas', num(r.reservas), num(a?.reservas)],
      ['Horas reservadas', num(r.horas), ''],
      ['Ocupación (%)', num(r.ocupacion), ''],
      ['Valor promedio por reserva (COP)', num(r.ticket_promedio), ''],
      ['Clientes', num(r.clientes), num(a?.clientes)],
      ['Clientes nuevos', num(r.clientes_nuevos), ''],
      ['Clientes recurrentes', num(r.clientes_recurrentes), ''],
      ['Reservas canceladas', num(r.canceladas), ''],
      ['Tasa de cancelación (%)', num(r.tasa_cancelacion), ''],
      ['No asistieron', num(r.no_asistio), ''],
      ['Reservas para hoy', num(r.reservas_hoy), ''],
      ['Partidos abiertos', num(r.partidos_abiertos), ''],
      ['Torneos activos', num(r.torneos_activos), ''],
    ]),
    ...seccion(
      'Rendimiento por cancha',
      ['Cancha', 'Tipo', 'Precio por hora (COP)', 'Reservas', 'Horas', 'Ocupación (%)', 'Ingresos (COP)',
        'Canceladas', 'Última reserva', 'Activa'],
      (m.por_cancha ?? []).map((c) => [
        c.cancha, c.tipo, num(c.precio_hora), num(c.reservas), num(c.horas), num(c.ocupacion),
        num(c.ingresos), num(c.canceladas), c.ultima_reserva ?? '', c.activa ? 'Sí' : 'No',
      ]),
    ),
    ...seccion('Reservas por día', ['Fecha', 'Reservas', 'Ingresos (COP)'],
      (m.reservas_por_dia ?? []).map((d) => [d.fecha, num(d.reservas), num(d.ingresos)])),
    ...seccion('Uso por hora del día', ['Franja', 'Reservas', 'Ocupación (%)'],
      (m.por_hora ?? []).map((h) => [franja(h.hora), num(h.reservas), num(h.ocupacion)])),
    ...seccion('Reservas por día de la semana', ['Día', 'Reservas'],
      (m.por_dia_semana ?? []).map((d) => [DIAS_SEMANA[d.dia - 1], num(d.reservas)])),
    ...seccion('Estado de las reservas', ['Estado', 'Reservas'],
      Object.keys(ESTADOS_RESERVA)
        .filter((k) => m.por_estado?.[k])
        .map((k) => [ESTADOS_RESERVA[k], num(m.por_estado[k])])),
    ...seccion('Métodos de pago', ['Método', 'Reservas'],
      (m.por_metodo_pago ?? []).map((p) => [METODOS_PAGO[p.metodo] ?? p.metodo, num(p.reservas)])),
    ...seccion('Mejores clientes', ['Cliente', 'Reservas', 'Ingresos (COP)', 'Última reserva'],
      (m.top_clientes ?? []).map((c) => [c.nombre, num(c.reservas), num(c.ingresos), c.ultima_reserva ?? ''])),
    ...seccion('Partidos por estado', ['Estado', 'Partidos'], contarPor(partidos, 'estado', ESTADOS_PARTIDO)),
    ...seccion('Torneos por estado', ['Estado', 'Torneos'], contarPor(torneos, 'estado', ESTADOS_TORNEO)),
  ]
}

function reportesGenerales(m, contenido) {
  const r = m.resumen
  const { partidos, torneos, canchas } = contenido
  const sedes = m.por_sede ?? []

  return [
    ...seccion('Resumen', ['Indicador', 'Valor'], [
      ['Usuarios registrados', num(r.usuarios)],
      ['Usuarios nuevos en el periodo', num(r.usuarios_nuevos)],
      ['Sedes', sedes.length],
      ['Canchas activas', canchas.filter((c) => c.activa).length],
      ['Partidos publicados', partidos.length],
      ['Partidos abiertos próximos', num(r.partidos_abiertos)],
      ['Torneos creados', torneos.length],
      ['Torneos activos', num(r.torneos_activos)],
      ['Reservas jugadas y confirmadas', num(r.reservas)],
      ['Reservas para hoy', num(r.reservas_hoy)],
      ['Reservas canceladas', num(r.canceladas)],
      ['Ingresos (COP)', num(r.ingresos)],
    ]),
    ...seccion('Por sede', ['Sede', 'Canchas activas', 'Partidos', 'Torneos', 'Reservas', 'Ingresos (COP)'],
      sedes.map((s) => [
        s.nombre,
        num(s.canchas),
        partidos.filter((p) => p.canchas?.sede_id === s.id).length,
        torneos.filter((t) => t.sede_id === s.id).length,
        num(s.reservas),
        num(s.ingresos),
      ])),
    ...seccion('Reservas por día', ['Fecha', 'Reservas', 'Ingresos (COP)'],
      (m.reservas_por_dia ?? []).map((d) => [d.fecha, num(d.reservas), num(d.ingresos)])),
    ...seccion('Canchas más reservadas', ['Cancha', 'Sede', 'Reservas', 'Ingresos (COP)'],
      (m.top_canchas ?? []).map((c) => [c.cancha, c.sede, num(c.reservas), num(c.ingresos)])),
    ...seccion('Usuarios por rol', ['Rol', 'Usuarios'],
      Object.keys(ROLES).map((k) => [ROLES[k], num(m.usuarios_por_rol?.[k])])),
    ...seccion('Partidos por estado', ['Estado', 'Partidos'], contarPor(partidos, 'estado', ESTADOS_PARTIDO)),
    ...seccion('Torneos por estado', ['Estado', 'Torneos'], contarPor(torneos, 'estado', ESTADOS_TORNEO)),
  ]
}

function descargar(nombre, texto) {
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// sedeId null: todo el negocio (solo superadmin). Devuelve { error }.
export async function exportarAnalitica({ desde, hasta, sedeId = null }) {
  const [metricas, contenido, reservas] = await Promise.all([
    sedeId ? analiticaSede(desde, hasta, sedeId) : metricasGlobales(desde, hasta),
    contenidoAdmin(),
    reservasParaExportar(desde, hasta, sedeId),
  ])
  const error = metricas.error ?? contenido.error ?? reservas.error
  if (error) return { error }

  const m = metricas.datos
  const nombreSede = sedeId ? m.sede?.nombre ?? `Sede ${sedeId}` : 'Todas las sedes'

  const filas = [
    ['Arma tu Cancha · Reporte de analítica'],
    ['Sede', nombreSede],
    ['Periodo', `${desde} a ${hasta}`],
    ['Generado', fechaHora(new Date().toISOString())],
    [],
    ...(sedeId ? reportesSede(m, contenido.datos, sedeId) : reportesGenerales(m, contenido.datos)),
    ...detalleReservas(reservas.datos),
  ]

  const texto = filas.map((f) => f.map(celda).join(SEP)).join('\r\n')
  descargar(`armatucancha-${slug(nombreSede)}-${desde}-a-${hasta}.csv`, texto)
  return { error: null }
}
