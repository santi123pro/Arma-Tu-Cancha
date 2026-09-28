import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MapaSedes from '../componentes/MapasSedes'
import Auth from './Auth'

const PASOS = [
  {
    num: '1',
    titulo: 'Elige tu sede',
    texto:
      'Mira las tres sedes de la ciudad, sus canchas y lo que ofrece cada una.',
  },
  {
    num: '2',
    titulo: 'Reserva tu hora',
    texto:
      'La disponibilidad se ve en tiempo real. Si la franja aparece libre, es libre.',
  },
  {
    num: '3',
    titulo: 'Arma el equipo',
    texto:
      'Te faltan jugadores? Publica el partido abierto y que se anoten los que quieran.',
  },
]

function bajarA(id) {
  const destino = document.getElementById(id)
  if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SeccionHero({ sedes, cargando }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <span className="hero-badge">Cali · Futbol 6</span>

        <h1 className="hero-title">
          Menos coordinación,
más <span>partido.</span>
        </h1>

        <p className="hero-desc">
          Reserva canchas sinteticas en Cali, completa tu equipo cuando falten
          jugadores y organiza torneos. Todo en un solo lugar.
        </p>

        <div className="hero-botones">
          <button
            type="button"
            className="btn-cta-primary"
            onClick={function () {
              bajarA('donde-jugamos')
            }}
          >
            Ver sedes y horarios
          </button>
        </div>
      </div>

      <div className="hero-card-preview">
        <div className="preview-header">
          <span>Sedes disponibles</span>
          <span className="badge-activo">EN LINEA</span>
        </div>

        {cargando ? (
          <div className="preview-row">
            <span>Cargando sedes...</span>
          </div>
        ) : sedes.length === 0 ? (
          <div className="preview-row">
            <span>Todavia no hay sedes publicadas.</span>
          </div>
        ) : (
          sedes.map(function (sede) {
            return (
              <div className="preview-row" key={sede.id || sede.slug}>
                <span>{sede.nombre}</span>
                <span className="badge-activo">Abierta</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function SeccionFlujo() {
  return (
    <section className="seccion-landing-light">
      <div className="landing-header-flex">
        <div>
          <span className="sub-tag">Como funciona</span>
          <h2 className="landing-title">Tres pasos y estas jugando</h2>
        </div>
        <p className="landing-desc-side">
          Sin llamadas, sin mensajes de WhatsApp para preguntar si hay cupo. Todo
          queda registrado en la plataforma.
        </p>
      </div>

      <div className="landing-grid-3">
        {PASOS.map(function (paso) {
          return (
            <div className="landing-card" key={paso.num}>
              <div className="card-num">{paso.num}</div>
              <h3>{paso.titulo}</h3>
              <p>{paso.texto}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SeccionMapa({ sedes, onVerSede }) {
  return (
    <section className="seccion-mapa-container" id="donde-jugamos">
      <div className="landing-header-flex">
        <div>
          <span className="sub-tag">Ubicaciones</span>
          <h2 className="landing-title">Donde jugamos?</h2>
        </div>
        <p className="landing-desc-side">
          Las tres sedes estan en el norte de Cali. Toca un marcador para ver sus
          canchas.
        </p>
      </div>

      <div className="mapa-wrapper">
        <MapaSedes sedes={sedes} onVerSede={onVerSede} />
      </div>
    </section>
  )
}

export default function Portada({ onVerSede }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(function () {
    let vigente = true

    async function cargar() {
      const { data, error } = await supabase
        .from('sedes')
        .select('id, slug, nombre, direccion')
        .eq('activa', true)
        .order('nombre')

      if (!vigente) return

      setSedes(error ? [] : data || [])
      setCargando(false)
    }

    cargar()

    return function () {
      vigente = false
    }
  }, [])

  function verSede(slug) {
    // Si App.jsx nos pasa onVerSede, la usamos (asi cambiabas de vista antes).
    if (onVerSede) {
      onVerSede(slug)
      return
    }
    // Respaldo: dejamos la sede en el hash de la URL.
    window.location.hash = '#/sede/' + slug
  }

  return (
    <main>
      <SeccionHero sedes={sedes} cargando={cargando} />
      <SeccionFlujo />
      <SeccionMapa sedes={sedes} onVerSede={verSede} />
      <Auth />
    </main>
  )
}
