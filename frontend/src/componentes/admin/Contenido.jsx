import { useEffect, useState } from 'react'
import { contenidoAdmin, eliminarPartido, eliminarTorneo } from '../../lib/datos'
import { useToast } from '../Toast'
import Cargando from '../Cargando'

const ESTADOS = {
  abierto: 'Abierto', completo: 'Completo', jugado: 'Jugado', cancelado: 'Cancelado',
  inscripciones: 'Inscripciones', cerrado: 'Cupos llenos', en_curso: 'En curso', finalizado: 'Finalizado',
}

function fecha(valor) {
  if (!valor) return 'Sin fecha'
  const [a, m, d] = valor.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BotonEliminar({ onEliminar }) {
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (!confirmar) {
    return (
      <button type="button" className="btn-icono-peligro" title="Eliminar" onClick={() => setConfirmar(true)}>
        🗑
      </button>
    )
  }

  return (
    <span className="admin-confirmar">
      <span className="admin-pregunta">¿Eliminar?</span>
      <button
        type="button" className="btn-peligro" disabled={enviando}
        onClick={async () => {
          setEnviando(true)
          const ok = await onEliminar()
          if (!ok) { setEnviando(false); setConfirmar(false) }
        }}
      >
        Sí
      </button>
      <button type="button" className="btn-torneo-cancelar" onClick={() => setConfirmar(false)}>No</button>
    </span>
  )
}

export default function Contenido() {
  const toast = useToast()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [sede, setSede] = useState('todas')

  useEffect(() => {
    let vigente = true
    contenidoAdmin().then(({ datos, error }) => {
      if (!vigente) return
      setError(error)
      setDatos(datos)
    })
    return () => { vigente = false }
  }, [recarga])

  async function eliminar(fn, id, nombre) {
    const { error } = await fn(id)
    if (error) {
      toast(error, 'error')
      return false
    }
    toast(`${nombre} eliminado`)
    setRecarga((n) => n + 1)
    return true
  }

  if (error) return <p className="partidos-aviso partidos-error">{error}</p>
  if (!datos) return <Cargando />

  // Sedes a partir de lo que hay cargado.
  const nombresSede = new Map()
  datos.torneos.forEach((t) => nombresSede.set(t.sede_id, t.sedes?.nombre))
  datos.partidos.forEach((p) => nombresSede.set(p.canchas?.sede_id, p.canchas?.sedes?.nombre))

  const torneos = datos.torneos.filter((t) => sede === 'todas' || String(t.sede_id) === sede)
  const partidos = datos.partidos.filter((p) => sede === 'todas' || String(p.canchas?.sede_id) === sede)

  return (
    <>
      <div className="admin-filtros">
        <span>Sede</span>
        <div className="admin-segmentos">
          <button type="button" className={sede === 'todas' ? 'activo' : ''} onClick={() => setSede('todas')}>
            Todas
          </button>
          {[...nombresSede].filter(([id]) => id != null).map(([id, nombre]) => (
            <button
              key={id} type="button"
              className={sede === String(id) ? 'activo' : ''}
              onClick={() => setSede(String(id))}
            >
              {nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-rejilla">
        <section className="admin-tarjeta">
          <header>
            <h3>🏆 Torneos <span className="admin-contador">{torneos.length}</span></h3>
            <p>Al eliminar un torneo se borran también sus equipos inscritos.</p>
          </header>
          {torneos.length === 0 ? (
            <p className="viz-vacio">No hay torneos.</p>
          ) : (
            <ul className="admin-lista">
              {torneos.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.nombre}</strong>
                    <small>
                      {t.sedes?.nombre} · {t.modalidad} · {t.cupos_inscritos}/{t.cupos_totales} equipos · {fecha(t.fecha_inicio)}
                    </small>
                  </div>
                  <span className={'admin-estado estado-' + t.estado}>{ESTADOS[t.estado] ?? t.estado}</span>
                  <BotonEliminar onEliminar={() => eliminar(eliminarTorneo, t.id, `Torneo "${t.nombre}"`)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-tarjeta">
          <header>
            <h3>⚽ Partidos <span className="admin-contador">{partidos.length}</span></h3>
            <p>Al eliminar un partido se borran también los jugadores anotados.</p>
          </header>
          {partidos.length === 0 ? (
            <p className="viz-vacio">No hay partidos.</p>
          ) : (
            <ul className="admin-lista">
              {partidos.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.canchas?.nombre} · {fecha(p.fecha)} {p.hora_inicio?.slice(0, 5)}</strong>
                    <small>
                      {p.canchas?.sedes?.nombre} · {p.modalidad} · {p.cupos_ocupados}/{p.cupos_totales} jugadores
                    </small>
                  </div>
                  <span className={'admin-estado estado-' + p.estado}>{ESTADOS[p.estado] ?? p.estado}</span>
                  <BotonEliminar onEliminar={() => eliminar(eliminarPartido, p.id, 'Partido')} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
