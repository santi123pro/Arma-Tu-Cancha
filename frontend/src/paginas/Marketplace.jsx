import { useEffect, useState } from 'react'
import { listarSedes } from '../lib/datos'

export default function Marketplace({ onElegirSede }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listarSedes().then(({ datos, error }) => {
      if (error) setError(error)
      else setSedes(datos ?? [])
      setCargando(false)
    })
  }, [])

  if (cargando) {
    return <Mensaje>Cargando establecimientos…</Mensaje>
  }

  if (error) {
    return <Mensaje color="#dc2626">{error}</Mensaje>
  }

  if (!sedes.length) {
    return (
      <Mensaje>
        Todavía no hay establecimientos registrados.
        <br />
        <small>¿Cargaste el archivo seed.sql en Supabase?</small>
      </Mensaje>
    )
  }

  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#0f172a', marginBottom: 10 }}>
        ¡Bienvenido, elige dónde vas a romperla hoy! ⚽
      </h2>
      <p style={{ color: '#64748b', marginBottom: 30 }}>
        Selecciona el complejo deportivo al que quieres ingresar.
      </p>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        {sedes.map((s) => (
          <TarjetaSede key={s.id} sede={s} onEntrar={() => onElegirSede(s.slug)} />
        ))}
      </div>
    </div>
  )
}

function TarjetaSede({ sede, onEntrar }) {
  const [hover, setHover] = useState(false)
  const totalCanchas = sede.canchas?.length ?? 0

  return (
    <div
      onClick={onEntrar}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
        width: 280, cursor: 'pointer', overflow: 'hidden',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
        transform: hover ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform .2s',
      }}
    >
      <div style={{
        height: 90, background: sede.color_hex ?? '#2563eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 40, fontWeight: 800,
        textShadow: '0 2px 8px rgba(0,0,0,.25)',
      }}>
        {sede.nombre.charAt(0)}
      </div>

      <div style={{ padding: 20 }}>
        <h3 style={{ color: '#0f172a', fontSize: 20, margin: '0 0 6px' }}>{sede.nombre}</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px', minHeight: 36 }}>
          {sede.descripcion ?? 'Canchas sintéticas disponibles.'}
        </p>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>
          📍 {sede.direccion}
        </p>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          🕒 {sede.hora_apertura?.slice(0, 5)} – {sede.hora_cierre?.slice(0, 5)} ·{' '}
          {totalCanchas} {totalCanchas === 1 ? 'cancha' : 'canchas'}
        </p>
        <button className="btn-cta-primary" style={{ marginTop: 15, width: '100%' }}>
          Entrar
        </button>
      </div>
    </div>
  )
}

function Mensaje({ children, color = '#64748b' }) {
  return (
    <p style={{ textAlign: 'center', padding: 60, color, lineHeight: 1.7 }}>
      {children}
    </p>
  )
}