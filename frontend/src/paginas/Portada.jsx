import { useEffect, useState } from 'react'
import { listarSedes } from '../lib/datos'
import { fotoSede } from '../lib/imagenes'
import MapaSedes from '../componentes/MapasSedes'
import ImagenSede from '../componentes/ImagenSede'

const PASOS = [
  {
    num: '01',
    icono: '📍',
    titulo: 'Elige tu sede',
    texto: 'Mira las sedes de la ciudad, sus canchas y lo que ofrece cada una.',
  },
  {
    num: '02',
    icono: '🗓️',
    titulo: 'Reserva tu hora',
    texto: 'La disponibilidad se ve en tiempo real. Si la franja aparece libre, es libre.',
  },
  {
    num: '03',
    icono: '⚽',
    titulo: 'Arma el equipo',
    texto: '¿Te faltan jugadores? Publica el partido abierto y que se anoten los que quieran.',
  },
]

function bajarA(id) {
  const destino = document.getElementById(id)
  if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function FilaSede({ sede, onVer }) {
  const totalCanchas = sede.canchas?.length ?? 0
  const apertura = sede.hora_apertura?.slice(0, 5)
  const cierre = sede.hora_cierre?.slice(0, 5)

  return (
    <button type="button" className="sede-fila" onClick={onVer}>
      <ImagenSede
        className="sede-fila-foto"
        url={fotoSede(sede) ?? sede.logo_url}
        color={sede.color_hex}
        texto={sede.nombre?.[0]}
      />
      <span className="sede-fila-texto">
        <strong>{sede.nombre}</strong>
        {sede.direccion && <small>📍 {sede.direccion}</small>}
        <span className="sede-fila-chips">
          {apertura && cierre && <span>🕒 {apertura} – {cierre}</span>}
          <span>{totalCanchas} {totalCanchas === 1 ? 'cancha' : 'canchas'}</span>
        </span>
      </span>
      <span className="sede-fila-flecha" aria-hidden="true">→</span>
    </button>
  )
}

function SeccionHero({ sedes, cargando, onIrLogin, onVerSede }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <span className="hero-badge">Cali · Canchas sintéticas</span>

        <h1 className="hero-title">
          Menos coordinación,
          <br />
          más <span>partido.</span>
        </h1>

        <p className="hero-desc">
          Reserva canchas sintéticas en Cali, completa tu equipo cuando falten
          jugadores y organiza torneos. Todo en un solo lugar.
        </p>

        <div className="hero-botones">
          <button type="button" className="btn-cta-primary btn-grande" onClick={onIrLogin}>
            Iniciar sesión / Registrarme
          </button>
          <button type="button" className="btn-cta-secondary btn-grande" onClick={() => bajarA('donde-jugamos')}>
            Ver sedes en el mapa
          </button>
        </div>

        <div className="hero-stats">
          <div><strong>{cargando ? '–' : sedes.length}</strong><span>sedes</span></div>
          <div>
            <strong>{cargando ? '–' : sedes.reduce((n, s) => n + (s.canchas?.length ?? 0), 0)}</strong>
            <span>canchas</span>
          </div>
          <div><strong>0</strong><span>llamadas</span></div>
        </div>
      </div>

      <div className="hero-card-preview">
        <div className="preview-header">
          <div>
            <span className="preview-titulo">Sedes disponibles</span>
            <span className="preview-sub">Toca una para ver sus canchas</span>
          </div>
          <span className="badge-activo">
            <span className="punto-vivo" /> EN LÍNEA
          </span>
        </div>

        <div className="preview-lista">
          {cargando ? (
            [1, 2, 3].map((n) => <div className="sede-fila sede-fila-esqueleto" key={n} />)
          ) : sedes.length === 0 ? (
            <p className="preview-vacio">Todavía no hay sedes publicadas.</p>
          ) : (
            sedes.map((sede) => (
              <FilaSede key={sede.id ?? sede.slug} sede={sede} onVer={() => onVerSede(sede.slug)} />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function SeccionFlujo({ onIrLogin }) {
  return (
    <section className="seccion-landing-light seccion-flujo">
      <div className="flujo-encabezado">
        <span className="sub-tag">Cómo funciona</span>
        <h2 className="landing-title">
          Tres pasos y <span className="texto-resaltado">estás jugando</span>
        </h2>
        <p className="landing-desc-side">
          Sin llamadas, sin mensajes de WhatsApp para preguntar si hay cupo. Todo
          queda registrado en la plataforma.
        </p>
      </div>

      <ol className="flujo-pasos">
        {PASOS.map((paso) => (
          <li className="flujo-paso" key={paso.num}>
            <span className="flujo-num" aria-hidden="true">{paso.num}</span>
            <div className="flujo-icono">{paso.icono}</div>
            <h3>{paso.titulo}</h3>
            <p>{paso.texto}</p>
          </li>
        ))}
      </ol>

      <div className="flujo-cta">
        <div>
          <h3>¿Listo para el primer pitazo?</h3>
          <p>Crea tu cuenta gratis y reserva en menos de un minuto.</p>
        </div>
        <button type="button" className="btn-cta-primary btn-grande" onClick={onIrLogin}>
          Empezar ahora →
        </button>
      </div>
    </section>
  )
}

function SeccionMapa({ sedes, onVerSede }) {
  return (
    <section className="seccion-landing-dark seccion-mapa" id="donde-jugamos">
      <div className="landing-header-flex">
        <div>
          <span className="sub-tag">Ubicaciones</span>
          <h2 className="landing-title-white">¿Dónde jugamos?</h2>
        </div>
        <p className="landing-desc-side-light">
          Las sedes están en el norte de Cali. Elige una de la lista o toca un
          marcador para ver sus canchas y cómo llegar.
        </p>
      </div>

      <MapaSedes sedes={sedes} onVerSede={onVerSede} />
    </section>
  )
}

export default function Portada({ onIrLogin, onVerSede }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(function () {
    let vigente = true

    listarSedes().then(function ({ datos, error }) {
      if (!vigente) return
      setSedes(error ? [] : datos ?? [])
      setCargando(false)
    })

    return function () {
      vigente = false
    }
  }, [])

  return (
    <main>
      <SeccionHero sedes={sedes} cargando={cargando} onIrLogin={onIrLogin} onVerSede={onVerSede} />
      <SeccionFlujo onIrLogin={onIrLogin} />
      <SeccionMapa sedes={sedes} onVerSede={onVerSede} />
    </main>
  )
}
