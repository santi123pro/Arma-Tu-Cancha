import { useEffect, useState } from 'react'
import { contenidoAdmin, metricasGlobales, metricasMiSede } from '../../lib/datos'
import { formatoNumero, formatoPesos } from '../../lib/formato'
import { BarrasAgrupadas, BarrasH, Cifra, Columnas, Dona } from './Graficas'

const RANGOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
]

const ESTADOS_PARTIDO = { abierto: 'Abierto', completo: 'Completo', jugado: 'Jugado', cancelado: 'Cancelado' }
const ESTADOS_TORNEO = {
  inscripciones: 'Inscripciones abiertas', cerrado: 'Cupos completos', en_curso: 'En curso',
  finalizado: 'Finalizado', cancelado: 'Cancelado',
}
const ROLES = {
  jugador: 'Jugadores',
  admin_sede: 'Administradores de sede',
  superadmin: 'Administradores generales',
}

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

// Sin sedeId: todo el negocio (superadmin). Con sedeId: solo esa sede (admin de sede).
export default function Analitica({ sedeId = null }) {
  const [dias, setDias] = useState(30)
  const [metricas, setMetricas] = useState(null)
  const [contenido, setContenido] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    const pedirMetricas = sedeId ? metricasMiSede : metricasGlobales
    Promise.all([pedirMetricas(haceDias(dias), haceDias(0)), contenidoAdmin()]).then(([m, c]) => {
      if (!vigente) return
      setError(m.error ?? c.error ?? null)
      setMetricas(m.datos)
      setContenido(c.datos)
      setCargando(false)
    })
    return () => { vigente = false }
  }, [dias, sedeId])

  function cambiarRango(n) {
    if (n === dias) return
    setCargando(true)
    setDias(n)
  }

  const filtros = (
    <div className="admin-filtros">
      <span>Periodo</span>
      <div className="admin-segmentos">
        {RANGOS.map((r) => (
          <button
            key={r.dias}
            type="button"
            className={r.dias === dias ? 'activo' : ''}
            onClick={() => cambiarRango(r.dias)}
          >
            {r.texto}
          </button>
        ))}
      </div>
    </div>
  )

  if (error) {
    return (
      <>
        {filtros}
        <p className="partidos-aviso partidos-error">{error}</p>
      </>
    )
  }

  if (cargando || !metricas || !contenido) {
    return (
      <>
        {filtros}
        <div className="admin-cifras">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="viz-cifra admin-esqueleto" />)}
        </div>
      </>
    )
  }

  const { resumen } = metricas
  const sedes = metricas.por_sede ?? []
  // RLS deja leer partidos, torneos y canchas de todas las sedes: se recorta aquí.
  const deMiSede = (id) => !sedeId || id === sedeId
  const partidos = contenido.partidos.filter((p) => deMiSede(p.canchas?.sede_id))
  const torneos = contenido.torneos.filter((t) => deMiSede(t.sede_id))
  const canchas = contenido.canchas.filter((c) => deMiSede(c.sede_id))

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

  const porCancha = metricas.por_cancha ?? []

  const usuariosRol = Object.keys(ROLES).map((k) => ({
    etiqueta: ROLES[k],
    valor: metricas.usuarios_por_rol?.[k] ?? 0,
  }))

  return (
    <>
      {filtros}

      <div className="admin-cifras">
        {sedeId ? (
          <Cifra icono="👥" etiqueta="Clientes" valor={formatoNumero(resumen.clientes)}
            detalle={`Con reservas en ${dias} días`} />
        ) : (
          <Cifra icono="👥" etiqueta="Usuarios" valor={formatoNumero(resumen.usuarios)}
            detalle={`+${formatoNumero(resumen.usuarios_nuevos)} en ${dias} días`} />
        )}
        <Cifra icono="🏟️" etiqueta="Canchas activas" valor={formatoNumero(canchasActivas)}
          detalle={sedeId ? metricas.sede?.nombre : `${sedes.length} sedes`} />
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

        {sedeId ? (
          <Tarjeta titulo="Reservas por cancha" subtitulo={`Últimos ${dias} días`}>
            <BarrasH datos={porCancha.map((c) => ({ etiqueta: c.cancha, valor: c.reservas }))} nombre="Reservas" />
          </Tarjeta>
        ) : (
          <>
            <Tarjeta titulo="Por sede" subtitulo="Canchas activas, partidos y torneos de cada sede">
              <BarrasAgrupadas grupos={porSede} series={['Canchas', 'Partidos', 'Torneos']} />
            </Tarjeta>

            <Tarjeta titulo="Usuarios por rol" subtitulo="Todas las cuentas registradas">
              <Dona datos={usuariosRol} nombre="Usuarios" centro="usuarios" />
            </Tarjeta>
          </>
        )}

        <Tarjeta titulo="Partidos por estado" subtitulo={sedeId ? 'Partidos publicados en tu sede' : 'Todos los partidos publicados'}>
          <BarrasH datos={contarPor(partidos, 'estado', ESTADOS_PARTIDO)} nombre="Partidos" />
        </Tarjeta>

        <Tarjeta titulo="Torneos por estado" subtitulo={sedeId ? 'Torneos creados en tu sede' : 'Todos los torneos creados'}>
          <BarrasH datos={contarPor(torneos, 'estado', ESTADOS_TORNEO)} nombre="Torneos" />
        </Tarjeta>

        <Tarjeta titulo={sedeId ? 'Ingresos por cancha' : 'Ingresos por sede'} subtitulo={`Últimos ${dias} días`}>
          <BarrasH
            datos={sedeId
              ? porCancha.map((c) => ({ etiqueta: c.cancha, valor: c.ingresos }))
              : sedes.map((s) => ({ etiqueta: s.nombre, valor: s.ingresos }))}
            nombre="Ingresos"
            formato={(n) => formatoPesos(n, true)}
          />
        </Tarjeta>

        {!sedeId && <Tarjeta titulo="Canchas más reservadas" subtitulo={`Top 5, últimos ${dias} días`}>
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
        </Tarjeta>}
      </div>
    </>
  )
}
