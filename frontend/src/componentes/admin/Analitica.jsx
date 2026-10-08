import { useEffect, useState } from 'react'
import { analiticaSede, contenidoAdmin, listarSedes, metricasGlobales } from '../../lib/datos'
import { formatoNumero, formatoPesos } from '../../lib/formato'
import { useToast } from '../Toast'
import { DIAS_SEMANA, ESTADOS_PARTIDO, ESTADOS_RESERVA, ESTADOS_TORNEO, METODOS_PAGO, ROLES } from './etiquetas'
import { exportarAnalitica } from './exportarCsv'
import { BarrasAgrupadas, BarrasH, Cifra, Columnas, Dona } from './Graficas'

const RANGOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
]

// Fecha local YYYY-MM-DD, n días atrás.
function haceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function contarPor(lista, clave, etiquetas) {
  const cuenta = {}
  for (const x of lista) cuenta[x[clave]] = (cuenta[x[clave]] ?? 0) + 1
  return Object.keys(etiquetas)
    .map((k) => ({ etiqueta: etiquetas[k], valor: cuenta[k] ?? 0 }))
    .filter((d) => d.valor > 0)
}

function diaCorto(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function diaLargo(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fechaTabla(fecha) {
  if (!fecha) return 'Sin reservas'
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

// '19:00:00' → '7 PM'
function horaCorta(hora) {
  const h = Number(hora.slice(0, 2))
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
}

// '19:00:00' → '7:00 PM – 8:00 PM'
function franja(hora) {
  const h = Number(hora.slice(0, 2))
  const f = (n) => `${n % 12 || 12}:00 ${n % 24 < 12 ? 'AM' : 'PM'}`
  return `${f(h)} – ${f(h + 1)}`
}

function horas(n) {
  const v = Number(n ?? 0)
  return `${formatoNumero(Number.isInteger(v) ? v : Math.round(v * 10) / 10)} h`
}

function porcentaje(n) {
  return `${formatoNumero(Number(n ?? 0))} %`
}

function Tarjeta({ titulo, subtitulo, children, ancha }) {
  return (
    <section className={'admin-tarjeta' + (ancha ? ' admin-tarjeta-ancha' : '')}>
      <header>
        <h3>{titulo}</h3>
        {subtitulo && <p>{subtitulo}</p>}
      </header>
      {children}
    </section>
  )
}

function Esqueleto() {
  return (
    <div className="admin-cifras">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <div key={n} className="viz-cifra admin-esqueleto" />)}
    </div>
  )
}

// Carga los datos de una vista cada vez que cambian sus parámetros.
function useCarga(pedir, deps) {
  const [estado, setEstado] = useState({ clave: null, datos: null, error: null })
  const clave = JSON.stringify(deps)

  useEffect(() => {
    let vigente = true
    pedir().then((r) => {
      if (vigente) setEstado({ clave, datos: r.datos, error: r.error })
    })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const cargando = estado.clave !== clave
  return { cargando, datos: cargando ? null : estado.datos, error: cargando ? null : estado.error }
}

// ═══════════════════════════════════════════════════════════════════
// Panel de analítica.
//   sedeId (admin de sede): siempre el detalle de su sede.
//   sin sedeId (superadmin): todo el negocio o el detalle de la sede que elija.
// ═══════════════════════════════════════════════════════════════════
export default function Analitica({ sedeId = null }) {
  const [dias, setDias] = useState(30)
  const [vista, setVista] = useState('todas')
  const [sedes, setSedes] = useState([])

  useEffect(() => {
    if (sedeId) return
    let vigente = true
    listarSedes().then(({ datos }) => {
      if (vigente) setSedes(datos ?? [])
    })
    return () => { vigente = false }
  }, [sedeId])

  const sedeElegida = sedeId ?? (vista === 'todas' ? null : Number(vista))
  const toast = useToast()
  const [exportando, setExportando] = useState(false)

  async function exportar() {
    setExportando(true)
    const { error } = await exportarAnalitica({ desde: haceDias(dias - 1), hasta: haceDias(0), sedeId: sedeElegida })
    setExportando(false)
    if (error) toast(error, 'error')
    else toast('Listo. El CSV con los reportes se descargó en tu equipo.')
  }

  return (
    <>
      <div className="admin-filtros-barra">
        <div className="admin-filtros">
          <span>Periodo</span>
          <div className="admin-segmentos">
            {RANGOS.map((r) => (
              <button
                key={r.dias}
                type="button"
                className={r.dias === dias ? 'activo' : ''}
                onClick={() => setDias(r.dias)}
              >
                {r.texto}
              </button>
            ))}
          </div>
        </div>

        {!sedeId && sedes.length > 0 && (
          <div className="admin-filtros">
            <span>Sede</span>
            <div className="admin-segmentos">
              <button type="button" className={vista === 'todas' ? 'activo' : ''} onClick={() => setVista('todas')}>
                Todas
              </button>
              {sedes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={vista === String(s.id) ? 'activo' : ''}
                  onClick={() => setVista(String(s.id))}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-cta-primary btn-chico admin-exportar"
          onClick={exportar}
          disabled={exportando}
          title="Descarga en CSV los reportes del periodo y el detalle de las reservas"
        >
          {exportando ? 'Preparando…' : '⬇️ Exportar datos'}
        </button>
      </div>

      {sedeElegida
        ? <AnaliticaSede key={sedeElegida} dias={dias} sedeId={sedeElegida} />
        : <AnaliticaGeneral dias={dias} />}
    </>
  )
}

// ───────────────────────────────────────────────────────────────────
// Detalle de una sede
// ───────────────────────────────────────────────────────────────────
function AnaliticaSede({ dias, sedeId }) {
  const { cargando, datos, error } = useCarga(
    () => Promise.all([analiticaSede(haceDias(dias - 1), haceDias(0), sedeId), contenidoAdmin()])
      .then(([a, c]) => ({ datos: { a: a.datos, c: c.datos }, error: a.error ?? c.error ?? null })),
    [dias, sedeId],
  )

  if (error) return <p className="partidos-aviso partidos-error">{error}</p>
  if (cargando || !datos?.a || !datos?.c) return <Esqueleto />

  const m = datos.a
  const { resumen, anterior } = m
  const sufijoPeriodo = `últimos ${dias} días`

  const canchas = m.por_cancha ?? []
  const conUso = canchas.filter((c) => c.activa)
  const masUsada = conUso[0]
  // Si todas están igual de usadas, no hay una "menos usada".
  const ultima = conUso[conUso.length - 1]
  const menosUsada = conUso.length > 1 && Number(ultima.horas) < Number(masUsada.horas) ? ultima : null

  const porHora = m.por_hora ?? []
  const horaPico = porHora.reduce((a, h) => (h.reservas > (a?.reservas ?? -1) ? h : a), null)
  const horaFloja = porHora.reduce((a, h) => (h.reservas < (a?.reservas ?? Infinity) ? h : a), null)
  const hayUso = Number(resumen.reservas) > 0

  const partidos = datos.c.partidos.filter((p) => p.canchas?.sede_id === sedeId)
  const torneos = datos.c.torneos.filter((t) => t.sede_id === sedeId)

  return (
    <>
      <p className="admin-sede-titulo">
        🏟️ <strong>{m.sede?.nombre}</strong>
        <span>
          {m.sede?.canchas_activas} {m.sede?.canchas_activas === 1 ? 'cancha activa' : 'canchas activas'} ·
          Horario {m.sede?.hora_apertura?.slice(0, 5)} – {m.sede?.hora_cierre?.slice(0, 5)}
        </span>
      </p>

      <div className="admin-cifras">
        <Cifra icono="💰" etiqueta="Ingresos" valor={formatoPesos(resumen.ingresos, true)}
          detalle={formatoPesos(resumen.ingresos)} actual={resumen.ingresos} anterior={anterior.ingresos} />
        <Cifra icono="📅" etiqueta="Reservas" valor={formatoNumero(resumen.reservas)}
          detalle={`${horas(resumen.horas)} reservadas`} actual={resumen.reservas} anterior={anterior.reservas} />
        <Cifra icono="📊" etiqueta="Ocupación" valor={porcentaje(resumen.ocupacion)}
          detalle="De las horas disponibles de todas las canchas" />
        <Cifra icono="🎟️" etiqueta="Valor promedio" valor={formatoPesos(resumen.ticket_promedio, true)}
          detalle="Por reserva" />
        <Cifra icono="👥" etiqueta="Clientes" valor={formatoNumero(resumen.clientes)}
          detalle={`${formatoNumero(resumen.clientes_nuevos)} nuevos · ${formatoNumero(resumen.clientes_recurrentes)} recurrentes`}
          actual={resumen.clientes} anterior={anterior.clientes} />
        <Cifra icono="❌" etiqueta="Cancelaciones" valor={formatoNumero(resumen.canceladas)}
          detalle={`${porcentaje(resumen.tasa_cancelacion)} de las reservas · ${formatoNumero(resumen.no_asistio)} no asistieron`} />
        <Cifra icono="🕒" etiqueta="Reservas para hoy" valor={formatoNumero(resumen.reservas_hoy)}
          detalle="Confirmadas y pendientes" />
        <Cifra icono="⚽" etiqueta="Partidos abiertos" valor={formatoNumero(resumen.partidos_abiertos)}
          detalle={`${formatoNumero(resumen.torneos_activos)} torneos activos`} />
      </div>

      {hayUso && (
        <div className="admin-destacados">
          {masUsada && (
            <div className="admin-destacado destacado-alto">
              <span>Cancha más usada</span>
              <strong>{masUsada.cancha}</strong>
              <small>{porcentaje(masUsada.ocupacion)} de ocupación · {formatoNumero(masUsada.reservas)} reservas</small>
            </div>
          )}
          {menosUsada && (
            <div className="admin-destacado destacado-bajo">
              <span>Cancha menos usada</span>
              <strong>{menosUsada.cancha}</strong>
              <small>{porcentaje(menosUsada.ocupacion)} de ocupación · {formatoNumero(menosUsada.reservas)} reservas</small>
            </div>
          )}
          {horaPico && (
            <div className="admin-destacado destacado-alto">
              <span>Hora pico</span>
              <strong>{franja(horaPico.hora)}</strong>
              <small>{formatoNumero(horaPico.reservas)} reservas · {porcentaje(horaPico.ocupacion)} de ocupación</small>
            </div>
          )}
          {horaFloja && (
            <div className="admin-destacado destacado-bajo">
              <span>Hora con menos uso</span>
              <strong>{franja(horaFloja.hora)}</strong>
              <small>{formatoNumero(horaFloja.reservas)} reservas · buen momento para promociones</small>
            </div>
          )}
        </div>
      )}

      <div className="admin-rejilla">
        <Tarjeta titulo="Rendimiento por cancha" subtitulo={`De la más usada a la menos usada, ${sufijoPeriodo}`} ancha>
          {canchas.length === 0 ? (
            <p className="viz-vacio">Esta sede no tiene canchas activas.</p>
          ) : (
            <div className="admin-tabla-scroll">
              <table className="admin-tabla admin-tabla-canchas">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cancha</th>
                    <th className="num">Reservas</th>
                    <th className="num">Horas</th>
                    <th>Ocupación</th>
                    <th className="num">Ingresos</th>
                    <th className="num admin-oculto-movil">Canceladas</th>
                    <th className="admin-oculto-movil">Última reserva</th>
                  </tr>
                </thead>
                <tbody>
                  {canchas.map((c, i) => (
                    <tr key={c.id}>
                      <td className="admin-rango">{i + 1}</td>
                      <td>
                        <strong className="admin-cancha-nombre">
                          {c.cancha}
                          {hayUso && c === masUsada && <em className="etiqueta-uso alto">Más usada</em>}
                          {hayUso && c === menosUsada && <em className="etiqueta-uso bajo">Menos usada</em>}
                          {!c.activa && <em className="etiqueta-uso retirada">Retirada</em>}
                        </strong>
                        <small className="admin-cancha-detalle">{c.tipo} · {formatoPesos(c.precio_hora)} / hora</small>
                      </td>
                      <td className="num">{formatoNumero(c.reservas)}</td>
                      <td className="num">{horas(c.horas)}</td>
                      <td>
                        <span className="admin-ocupacion">
                          <span className="admin-ocupacion-pista">
                            <i style={{ width: `${Math.min(100, Number(c.ocupacion))}%` }} />
                          </span>
                          {porcentaje(c.ocupacion)}
                        </span>
                      </td>
                      <td className="num">{formatoPesos(c.ingresos)}</td>
                      <td className="num admin-oculto-movil">{formatoNumero(c.canceladas)}</td>
                      <td className="admin-oculto-movil">{fechaTabla(c.ultima_reserva)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Reservas por día" subtitulo={`Jugadas y confirmadas, ${sufijoPeriodo}`} ancha>
          <Columnas
            nombre="Reservas"
            datos={(m.reservas_por_dia ?? []).map((d) => ({
              etiqueta: diaCorto(d.fecha),
              detalle: `${diaLargo(d.fecha)} · ${formatoPesos(d.ingresos)}`,
              valor: d.reservas,
            }))}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Uso por hora del día"
          subtitulo={hayUso && horaPico
            ? `Hora pico: ${franja(horaPico.hora)}. Cada barra es una franja del horario de la sede.`
            : 'Cada barra es una franja del horario de la sede.'}
          ancha
        >
          <Columnas
            nombre="Reservas"
            datos={porHora.map((h) => ({
              etiqueta: horaCorta(h.hora),
              detalle: `${franja(h.hora)} · ${porcentaje(h.ocupacion)} de ocupación`,
              valor: h.reservas,
            }))}
          />
        </Tarjeta>

        <Tarjeta titulo="Reservas por día de la semana" subtitulo={sufijoPeriodo[0].toUpperCase() + sufijoPeriodo.slice(1)}>
          <BarrasH
            nombre="Reservas"
            datos={hayUso ? (m.por_dia_semana ?? []).map((d) => ({ etiqueta: DIAS_SEMANA[d.dia - 1], valor: d.reservas })) : []}
          />
        </Tarjeta>

        <Tarjeta titulo="Ingresos por cancha" subtitulo={sufijoPeriodo[0].toUpperCase() + sufijoPeriodo.slice(1)}>
          <BarrasH
            nombre="Ingresos"
            formato={(n) => formatoPesos(n, true)}
            datos={hayUso ? canchas.map((c) => ({ etiqueta: c.cancha, valor: c.ingresos })) : []}
          />
        </Tarjeta>

        <Tarjeta titulo="Mejores clientes" subtitulo={`Los que más reservaron, ${sufijoPeriodo}`}>
          {m.top_clientes?.length ? (
            <table className="admin-tabla admin-tabla-compacta">
              <thead>
                <tr><th>Cliente</th><th className="num">Reservas</th><th className="num">Ingresos</th></tr>
              </thead>
              <tbody>
                {m.top_clientes.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <strong className="admin-cancha-nombre">{c.nombre}</strong>
                      <small className="admin-cancha-detalle">Última: {fechaTabla(c.ultima_reserva)}</small>
                    </td>
                    <td className="num">{formatoNumero(c.reservas)}</td>
                    <td className="num">{formatoPesos(c.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="viz-vacio">Sin reservas en este periodo.</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Estado de las reservas" subtitulo="Todas las del periodo, incluidas las canceladas">
          <BarrasH
            nombre="Reservas"
            datos={Object.keys(ESTADOS_RESERVA)
              .map((k) => ({ etiqueta: ESTADOS_RESERVA[k], valor: m.por_estado?.[k] ?? 0 }))
              .filter((d) => d.valor > 0)}
          />
        </Tarjeta>

        <Tarjeta titulo="Métodos de pago" subtitulo="Reservas jugadas y confirmadas">
          <BarrasH
            nombre="Reservas"
            datos={(m.por_metodo_pago ?? []).map((p) => ({ etiqueta: METODOS_PAGO[p.metodo] ?? p.metodo, valor: p.reservas }))}
          />
        </Tarjeta>

        <Tarjeta titulo="Partidos por estado" subtitulo="Partidos publicados en la sede">
          <BarrasH datos={contarPor(partidos, 'estado', ESTADOS_PARTIDO)} nombre="Partidos" />
        </Tarjeta>

        <Tarjeta titulo="Torneos por estado" subtitulo="Torneos creados en la sede">
          <BarrasH datos={contarPor(torneos, 'estado', ESTADOS_TORNEO)} nombre="Torneos" />
        </Tarjeta>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────
// Todo el negocio (solo superadmin)
// ───────────────────────────────────────────────────────────────────
function AnaliticaGeneral({ dias }) {
  const { cargando, datos, error } = useCarga(
    () => Promise.all([metricasGlobales(haceDias(dias - 1), haceDias(0)), contenidoAdmin()])
      .then(([m, c]) => ({ datos: { m: m.datos, c: c.datos }, error: m.error ?? c.error ?? null })),
    [dias],
  )

  if (error) return <p className="partidos-aviso partidos-error">{error}</p>
  if (cargando || !datos?.m || !datos?.c) return <Esqueleto />

  const metricas = datos.m
  const { resumen } = metricas
  const sedes = metricas.por_sede ?? []
  const { partidos, torneos, canchas } = datos.c

  const canchasActivas = canchas.filter((c) => c.activa).length
  const porSede = sedes.map((s) => ({
    etiqueta: s.nombre,
    valores: [
      canchas.filter((c) => c.sede_id === s.id && c.activa).length,
      partidos.filter((p) => p.canchas?.sede_id === s.id).length,
      torneos.filter((t) => t.sede_id === s.id).length,
    ],
  }))

  const reservasDia = (metricas.reservas_por_dia ?? []).map((d) => ({
    etiqueta: diaCorto(d.fecha),
    detalle: diaLargo(d.fecha),
    valor: d.reservas,
  }))

  const usuariosRol = Object.keys(ROLES).map((k) => ({
    etiqueta: ROLES[k],
    valor: metricas.usuarios_por_rol?.[k] ?? 0,
  }))

  return (
    <>
      <div className="admin-cifras">
        <Cifra icono="👥" etiqueta="Usuarios" valor={formatoNumero(resumen.usuarios)}
          detalle={`+${formatoNumero(resumen.usuarios_nuevos)} en ${dias} días`} />
        <Cifra icono="🏟️" etiqueta="Canchas activas" valor={formatoNumero(canchasActivas)}
          detalle={`${sedes.length} sedes`} />
        <Cifra icono="⚽" etiqueta="Partidos" valor={formatoNumero(partidos.length)}
          detalle={`${formatoNumero(resumen.partidos_abiertos)} abiertos próximos`} />
        <Cifra icono="🏆" etiqueta="Torneos" valor={formatoNumero(torneos.length)}
          detalle={`${formatoNumero(resumen.torneos_activos)} activos`} />
        <Cifra icono="📅" etiqueta="Reservas" valor={formatoNumero(resumen.reservas)}
          detalle={`${formatoNumero(resumen.reservas_hoy)} hoy · ${formatoNumero(resumen.canceladas)} canceladas`} />
        <Cifra icono="💰" etiqueta="Ingresos" valor={formatoPesos(resumen.ingresos, true)}
          detalle={`Últimos ${dias} días`} />
      </div>

      <div className="admin-rejilla">
        <Tarjeta titulo="Reservas por día" subtitulo={`Confirmadas y completadas, últimos ${dias} días`} ancha>
          <Columnas datos={reservasDia} nombre="Reservas" />
        </Tarjeta>

        <Tarjeta titulo="Por sede" subtitulo="Canchas activas, partidos y torneos de cada sede">
          <BarrasAgrupadas grupos={porSede} series={['Canchas', 'Partidos', 'Torneos']} />
        </Tarjeta>

        <Tarjeta titulo="Usuarios por rol" subtitulo="Todas las cuentas registradas">
          <Dona datos={usuariosRol} nombre="Usuarios" centro="usuarios" />
        </Tarjeta>

        <Tarjeta titulo="Partidos por estado" subtitulo="Todos los partidos publicados">
          <BarrasH datos={contarPor(partidos, 'estado', ESTADOS_PARTIDO)} nombre="Partidos" />
        </Tarjeta>

        <Tarjeta titulo="Torneos por estado" subtitulo="Todos los torneos creados">
          <BarrasH datos={contarPor(torneos, 'estado', ESTADOS_TORNEO)} nombre="Torneos" />
        </Tarjeta>

        <Tarjeta titulo="Ingresos por sede" subtitulo={`Últimos ${dias} días · elige una sede arriba para ver su detalle`}>
          <BarrasH
            datos={sedes.map((s) => ({ etiqueta: s.nombre, valor: s.ingresos }))}
            nombre="Ingresos"
            formato={(n) => formatoPesos(n, true)}
          />
        </Tarjeta>

        <Tarjeta titulo="Canchas más reservadas" subtitulo={`Top 5, últimos ${dias} días`}>
          {metricas.top_canchas?.length ? (
            <table className="admin-tabla admin-tabla-compacta">
              <thead>
                <tr><th>Cancha</th><th>Sede</th><th className="num">Reservas</th><th className="num">Ingresos</th></tr>
              </thead>
              <tbody>
                {metricas.top_canchas.map((c) => (
                  <tr key={c.sede + c.cancha}>
                    <td>{c.cancha}</td>
                    <td>{c.sede}</td>
                    <td className="num">{formatoNumero(c.reservas)}</td>
                    <td className="num">{formatoPesos(c.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="viz-vacio">Sin reservas en este periodo.</p>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
