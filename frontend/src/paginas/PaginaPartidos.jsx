import { useEffect, useState } from 'react'
import { detalleSede } from '../lib/datos'
import { fotoSede } from '../lib/imagenes'
import { temaSede } from '../lib/temas'
import Partidos from './Partidos'
import Torneos from './Torneos'
import MisReservas from './MisReservas'
import Cargando from '../componentes/Cargando'

// Textos del banner segun la pestaña. Ambas comparten el mismo diseño.
const TIPOS = {
  partidos: {
    etiqueta: 'Partidos abiertos',
    titulo: '¿Te faltan jugadores?',
    resaltado: 'Arma el partido.',
    desc: (sede) =>
      `Publica tu partido y que se anoten los que quieran, o únete a uno que esté buscando gente en ${sede}.`,
    otro: '🏆 Ver torneos',
    Contenido: Partidos,
  },
  torneos: {
    etiqueta: 'Torneos',
    titulo: 'Que ruede el balón,',
    resaltado: 'que gane el mejor.',
    desc: (sede) =>
      `Inscribe a tu equipo en los torneos de ${sede}, sigue los cupos y pelea por el premio.`,
    otro: '⚽ Ver partidos',
    Contenido: Torneos,
  },
  reservas: {
    etiqueta: 'Mis reservas',
    titulo: 'Tus canchas,',
    resaltado: 'tus horarios.',
    desc: (sede) =>
      `Aquí ves las canchas que reservaste en ${sede}: las próximas, las que ya jugaste y las canceladas.`,
    Contenido: MisReservas,
  },
}

// Pagina propia para partidos, torneos o las reservas del jugador en una sede.
export default function PaginaPartidos({ slug, tipo = 'partidos', onVolver, onCambiar }) {
  const [sede, setSede] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    detalleSede(slug).then(({ datos, error }) => {
      if (!vigente) return
      if (error) setError(error)
      else setSede(datos)
      setCargando(false)
    })
    return () => { vigente = false }
  }, [slug])

  if (cargando) {
    return <Cargando tamano="grande" />
  }

  if (error || !sede) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#dc2626' }}>No fue posible cargar la sede.</p>
        <button onClick={onVolver} className="btn-cta-primary" style={{ marginTop: 20 }}>
          Volver
        </button>
      </div>
    )
  }

  const t = TIPOS[tipo] ?? TIPOS.partidos
  const foto = fotoSede(sede)

  return (
    <main className={'pagina-partidos pagina-' + tipo + ' ' + temaSede(sede)}>
      <section
        className="partidos-hero"
        style={{
          '--sede-color': sede.color_hex ?? '#22c55e',
          backgroundImage: foto ? `url(${foto})` : undefined,
        }}
      >
        <div className="partidos-hero-contenido">
          <div className="partidos-hero-nav">
            <button type="button" className="partidos-hero-volver" onClick={onVolver}>
              ← Volver a {sede.nombre}
            </button>
            {onCambiar && t.otro && (
              <button type="button" className="partidos-hero-volver partidos-hero-otro" onClick={onCambiar}>
                {t.otro} →
              </button>
            )}
          </div>
          <span className="hero-badge">{t.etiqueta} · {sede.nombre}</span>
          <h1 className="partidos-hero-titulo">
            {t.titulo} <span>{t.resaltado}</span>
          </h1>
          <p className="partidos-hero-desc">{t.desc(sede.nombre)}</p>
        </div>
      </section>

      <div className="partidos-contenedor">
        <t.Contenido sedeId={sede.id} sedeNombre={sede.nombre} />
      </div>
    </main>
  )
}
